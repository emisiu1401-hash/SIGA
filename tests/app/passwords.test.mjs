import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { LocalD1 } from "../../scripts/sqlite.mjs";
import {
  Repository,
  seedDirectory,
  hashPassword,
  verifyPassword,
  passwordLogin,
  passwordSession,
  passwordLogout,
  changePassword,
  provisionPassword,
  accessAccounts,
  disablePassword,
  requestPasswordReset,
  resetPassword,
  tokenHash,
  createAggregate,
  transition,
  authRate,
  fetchHandler,
} from "../../dist/testing.js";
const origin = "http://127.0.0.1",
  at = new Date().toISOString(),
  nextPassword = "Frase-pessoal-exclusiva-2026!";
const request = (cookie = "", ip = "127.0.0.1") =>
  new Request(origin + "/api/login", {
    headers: { Cookie: cookie, "CF-Connecting-IP": ip },
  });
async function setup() {
  const db = new LocalD1();
  db.migrate();
  const repo = new Repository(db, true, "mock-mailbox", "password-test");
  await seedDirectory(repo);
  await db
    .prepare("INSERT OR IGNORE INTO user_roles VALUES('u-gestor','ADMIN')")
    .run();
  const people = await repo.people(),
    owner = people.find((x) => x.id === "u-gestor"),
    sdg = people.find((x) => x.id === "u-sdg"),
    env = {
      DB: db,
      DEPLOYMENT_MODE: "development",
      ACCESS_REQUIRED: "false",
      AUTH_MODE: "access_password",
      PUBLIC_DEMO: "false",
      SIMULATION_MODE: "true",
      AI_PROVIDER: "mock",
      EMAIL_SEND_ENABLED: "false",
      SEI_ALLOWED_HOSTS: "sei.tjmsp.jus.br",
      APP_ORIGIN: origin,
    };
  const credentials = await provisionPassword(repo, owner, owner.id, "emerson");
  return { db, repo, owner, sdg, env, credentials };
}
const access = (f) => ({ email: f.owner.email, csrf: "access-proof" });
async function logged(f) {
  const login = await passwordLogin(
    request(),
    f.repo,
    { account: "emerson", password: f.credentials.temporaryPassword },
    access(f),
  );
  return { ...login, cookie: login.cookie.split(";")[0] };
}
const call = (f, path, cookie = "", body, csrf) =>
  fetchHandler(
    new Request(origin + path, {
      method: body ? "POST" : "GET",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    f.env,
  );
test("senha usa scrypt com sal único e rejeita senha curta sem gravar texto puro", async () => {
  const a = await hashPassword(nextPassword),
    b = await hashPassword(nextPassword);
  assert.notEqual(a, b);
  assert.match(a, /^scrypt\$16384\$8\$5\$/);
  assert.equal(await verifyPassword(nextPassword, a), true);
  assert.equal(await verifyPassword("outro", a), false);
  await assert.rejects(
    hashPassword("curta"),
    (e) => e.code === "PASSWORD_POLICY",
  );
});
test("senha temporária bloqueia API; troca exige senha atual, encerra sessões e exige novo login", async () => {
  const f = await setup(),
    l = await logged(f);
  assert.match(l.cookie, /^siga_password=/);
  assert.equal(
    (await passwordSession(request(l.cookie), f.repo, access(f)))
      .mustChangePassword,
    true,
  );
  assert.equal((await call(f, "/api/dashboard", l.cookie)).status, 403);
  assert.equal(
    (
      await call(
        f,
        "/api/auth/change",
        l.cookie,
        {
          currentPassword: f.credentials.temporaryPassword,
          newPassword: nextPassword,
        },
        "fake",
      )
    ).status,
    403,
  );
  await assert.rejects(
    changePassword(f.repo, f.owner, {
      currentPassword: "errada",
      newPassword: nextPassword,
    }),
    (e) => e.code === "AUTH",
  );
  await changePassword(f.repo, f.owner, {
    currentPassword: f.credentials.temporaryPassword,
    newPassword: nextPassword,
  });
  await assert.rejects(
    passwordSession(request(l.cookie), f.repo, access(f)),
    (e) => e.status === 401,
  );
  await assert.rejects(
    passwordLogin(
      request(),
      f.repo,
      { account: "emerson", password: f.credentials.temporaryPassword },
      access(f),
    ),
  );
  const newer = await passwordLogin(
    request(),
    f.repo,
    { account: f.owner.email, password: nextPassword },
    access(f),
  );
  assert.equal(newer.mustChangePassword, false);
  assert.equal(
    (await passwordSession(request(newer.cookie), f.repo, access(f))).actor.id,
    f.owner.id,
  );
  assert.ok(!JSON.stringify(await accessAccounts(f.repo)).includes("scrypt"));
  f.db.close();
});
test("identidade Cloudflare deve corresponder à conta, sem cookie legado nem sessão forjada", async () => {
  const f = await setup();
  await assert.rejects(
    passwordLogin(
      request(),
      f.repo,
      { account: "emerson", password: f.credentials.temporaryPassword },
      { email: "other@example.test", csrf: "x" },
    ),
    (e) => e.code === "AUTH",
  );
  const l = await logged(f);
  await assert.rejects(
    passwordSession(request(l.cookie), f.repo, {
      email: "other@example.test",
      csrf: "x",
    }),
  );
  await assert.rejects(
    passwordSession(
      request("siga_session=legacy;siga_password=forged"),
      f.repo,
      access(f),
    ),
  );
  const root = await call(f, "/");
  assert.match(await root.text(), /auth-form/);
  assert.equal((await call(f, "/api/dashboard")).status, 401);
  f.db.close();
});
test("limite de tentativas é atômico por conta e não é removido por login de outro IP", async () => {
  const f = await setup();
  const results = await Promise.allSettled(
    Array.from({ length: 9 }, () => authRate(f.repo, "same-account", 8)),
  );
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 8);
  assert.equal(results.find((x) => x.status === "rejected").reason.status, 429);
  f.db.close();
});
test("logout revoga sessão opaca e emissão nova invalida credencial anterior", async () => {
  const f = await setup(),
    l = await logged(f);
  await passwordLogout(request(l.cookie), f.repo, f.owner);
  await assert.rejects(passwordSession(request(l.cookie), f.repo, access(f)));
  const newer = await provisionPassword(f.repo, f.owner, f.owner.id, "emerson");
  await assert.rejects(
    passwordLogin(
      request(),
      f.repo,
      { account: "emerson", password: f.credentials.temporaryPassword },
      access(f),
    ),
  );
  assert.notEqual(newer.temporaryPassword, f.credentials.temporaryPassword);
  f.db.close();
});
test("SDG troca sua senha mas continua sem escrita administrativa; ADMIN não reemite senha do titular", async () => {
  const f = await setup(),
    c = await provisionPassword(f.repo, f.owner, f.sdg.id, "sdg"),
    identity = { email: f.sdg.email, csrf: "x" };
  let l = await passwordLogin(
    request(),
    f.repo,
    { account: "sdg", password: c.temporaryPassword },
    identity,
  );
  await changePassword(f.repo, f.sdg, {
    currentPassword: c.temporaryPassword,
    newPassword: nextPassword,
  });
  l = await passwordLogin(
    request(),
    f.repo,
    { account: "sdg", password: nextPassword },
    identity,
  );
  assert.equal((await call(f, "/api/auth/accounts", l.cookie)).status, 403);
  assert.equal(
    (
      await call(
        f,
        "/api/demands",
        l.cookie,
        { title: "Mutação indevida", commandId: crypto.randomUUID() },
        l.csrf,
      )
    ).status,
    403,
  );
  const admin = (await f.repo.people()).find((x) => x.id === "u-admin");
  await assert.rejects(
    provisionPassword(f.repo, admin, f.owner.id, "emerson"),
    (e) => e.status === 403,
  );
  f.db.close();
});
test("desabilitar acesso e alterar cadastro revogam sessões e links", async () => {
  const f = await setup(),
    p = (await f.repo.people()).find((p) => p.id === "u-gabriela"),
    c = await provisionPassword(f.repo, f.owner, p.id, "executor"),
    identity = { email: p.email, csrf: "x" },
    l = await passwordLogin(
      request(),
      f.repo,
      { account: "executor", password: c.temporaryPassword },
      identity,
    );
  await f.repo.personSave({ ...p, name: "Nome atualizado" }, f.owner.id, at);
  await assert.rejects(passwordSession(request(l.cookie), f.repo, identity));
  await disablePassword(f.repo, f.owner, p.id);
  await assert.rejects(
    passwordLogin(
      request(),
      f.repo,
      { account: "executor", password: c.temporaryPassword },
      identity,
    ),
  );
  await assert.rejects(disablePassword(f.repo, f.owner, f.owner.id));
  f.db.close();
});
async function withMail(f, run) {
  const old = globalThis.fetch,
    sent = [];
  const env = {
    ...f.env,
    SIMULATION_MODE: "false",
    EMAIL_SEND_ENABLED: "true",
    GOOGLE_CLIENT_ID: "fixture-client",
    GOOGLE_CLIENT_SECRET: "fixture-secret",
    GOOGLE_REFRESH_TOKEN: "fixture-refresh",
    MAILBOX_ID: "sender@example.test",
  };
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/token"))
      return Response.json({ access_token: "fixture-access" });
    if (String(url).endsWith("/profile"))
      return Response.json({ emailAddress: env.MAILBOX_ID });
    if (String(url).endsWith("/messages/send")) {
      const raw = JSON.parse(options.body).raw,
        mime = Buffer.from(raw, "base64url").toString(),
        text = Buffer.from(mime.split("\r\n\r\n")[1], "base64").toString();
      sent.push({ mime, text, token: text.match(/#reset=([\w-]+)/)?.[1] });
      return Response.json({ id: "fixture-message" });
    }
    throw Error("Unexpected provider URL");
  };
  try {
    return await run(env, sent);
  } finally {
    globalThis.fetch = old;
  }
}
test("recuperação Gmail usa link efêmero, segredo só no e-mail e resposta genérica para desconhecido", async () => {
  const f = await setup(),
    l = await logged(f);
  await withMail(f, async (env, sent) => {
    const yes = await requestPasswordReset(
        request(),
        f.repo,
        env,
        { account: "emerson" },
        access(f),
      ),
      no = await requestPasswordReset(
        request(),
        f.repo,
        env,
        { account: "unknown" },
        access(f),
      );
    assert.deepEqual(yes, no);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /http:\/\/127\.0\.0\.1\/login#reset=/);
    const token = sent[0].token;
    assert.ok(token);
    const stored = f.db.raw.prepare("SELECT * FROM password_links").get();
    assert.equal(stored.token_hash, await tokenHash(token));
    assert.ok(!JSON.stringify(stored).includes(token));
    assert.ok(
      !JSON.stringify(
        f.db.raw.prepare("SELECT * FROM audit_log").all(),
      ).includes(token),
    );
    assert.equal(
      f.db.raw.prepare("SELECT count(*) n FROM outbound_messages").get().n,
      0,
    );
    await resetPassword(
      f.repo,
      { token, newPassword: nextPassword },
      access(f),
    );
    await assert.rejects(
      resetPassword(f.repo, { token, newPassword: nextPassword }, access(f)),
      (e) => e.code === "PASSWORD_LINK",
    );
    await assert.rejects(passwordSession(request(l.cookie), f.repo, access(f)));
    assert.equal(
      (
        await passwordLogin(
          request(),
          f.repo,
          { account: "emerson", password: nextPassword },
          access(f),
        )
      ).mustChangePassword,
      false,
    );
  });
  f.db.close();
});
test("link expirado, de outra identidade, revogado e concorrente é rejeitado", async () => {
  const f = await setup();
  await withMail(f, async (env, sent) => {
    await requestPasswordReset(
      request(),
      f.repo,
      env,
      { account: "emerson" },
      access(f),
    );
    const token = sent[0].token;
    await assert.rejects(
      resetPassword(
        f.repo,
        { token, newPassword: nextPassword },
        { email: "other@example.test", csrf: "x" },
      ),
      (e) => e.code === "PASSWORD_LINK",
    );
    f.db.raw.prepare("UPDATE password_links SET expires_at=0").run();
    await assert.rejects(
      resetPassword(f.repo, { token, newPassword: nextPassword }, access(f)),
      (e) => e.code === "PASSWORD_LINK",
    );
    await requestPasswordReset(
      request(),
      f.repo,
      env,
      { account: "emerson" },
      access(f),
    );
    const newer = sent[1].token;
    const outcomes = await Promise.allSettled([
      resetPassword(
        f.repo,
        { token: newer, newPassword: nextPassword },
        access(f),
      ),
      resetPassword(
        f.repo,
        { token: newer, newPassword: "Outra-frase-exclusiva-2026!" },
        access(f),
      ),
    ]);
    assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
  });
  f.db.close();
});
test("Gmail pendente não promete envio nem cria link e reset forjado não altera credencial", async () => {
  const f = await setup();
  await assert.rejects(
    requestPasswordReset(
      request(),
      f.repo,
      f.env,
      { account: "emerson" },
      access(f),
    ),
    (e) => e.code === "PASSWORD_MAIL_SETUP",
  );
  assert.equal(
    f.db.raw.prepare("SELECT count(*) n FROM password_links").get().n,
    0,
  );
  await assert.rejects(
    resetPassword(
      f.repo,
      {
        token: randomBytes(32).toString("base64url"),
        newPassword: nextPassword,
      },
      access(f),
    ),
  );
  assert.ok(
    await passwordLogin(
      request(),
      f.repo,
      { account: "emerson", password: f.credentials.temporaryPassword },
      access(f),
    ),
  );
  f.db.close();
});
test("novo Gestor pode gerir e atribuir; somente Emerson encerra definitivamente", async () => {
  const f = await setup(),
    p = (await f.repo.people()).find((x) => x.id === "u-ana");
  await f.repo.personSave({ ...p, roles: ["GESTOR"] }, f.owner.id, at);
  const people = await f.repo.people(),
    manager = people.find((x) => x.id === p.id),
    executor = people.find((x) => x.id === "u-gabriela");
  let s = createAggregate(
    "new-manager",
    "SIGA-2026-9999",
    "Demanda gerida",
    "Descrição",
    f.owner.id,
    at,
  );
  const apply = (type, actor, extra = {}) => {
    s = transition(
      s,
      { id: crypto.randomUUID(), type, expectedVersion: s.version, ...extra },
      actor,
      people,
      at,
    ).state;
  };
  apply("CREATE", manager);
  apply("ASSIGN", manager, { personId: executor.id, priority: "ALTA" });
  apply("ACCEPT", executor, { date: "2026-10-30" });
  apply("DECLARE", executor, { reason: "Etapa declarada concluída" });
  const r = s.requests.find((x) => x.type === "CONCLUSAO");
  assert.throws(
    () => apply("DECIDE", manager, { requestId: r.id, decision: "APPROVE" }),
    (e) => e.code === "FORBIDDEN",
  );
  assert.equal(s.status, "AGUARDANDO_VALIDACAO");
  apply("DECIDE", f.owner, { requestId: r.id, decision: "APPROVE" });
  assert.equal(s.status, "ENCERRADA");
  assert.equal(s.closedBy, "u-gestor");
  f.db.close();
});
