import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { LocalD1 } from "../../scripts/sqlite.mjs";
import {
  Repository,
  seedDirectory,
  fetchHandler,
  scheduledHandler,
  configuredAi,
} from "../../dist/testing.js";

const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: "privacy-test-key",
  alg: "RS256",
};
const issuer = "https://siga-privacy-tests.cloudflareaccess.com";
const owner = "owner@example.test";
async function fixture() {
  const db = new LocalD1();
  db.migrate();
  const repo = new Repository(db);
  await seedDirectory(repo);
  await db
    .prepare("UPDATE users SET email=? WHERE id='u-gestor'")
    .bind(owner)
    .run();
  await db
    .prepare("INSERT INTO app_settings VALUES('deployment_identity',?,?)")
    .bind(JSON.stringify({ mode: "private" }), new Date().toISOString())
    .run();
  const env = {
    DB: db,
    DEPLOYMENT_MODE: "private",
    PUBLIC_DEMO: "false",
    ACCESS_REQUIRED: "true",
    ACCESS_TEAM_DOMAIN: issuer,
    ACCESS_AUD: "private-test-audience",
    ACCESS_ALLOWED_EMAILS: owner,
    SIMULATION_MODE: "true",
    AI_PROVIDER: "mock",
    AI_MODEL: "test",
    EMAIL_SEND_ENABLED: "false",
    SEI_ALLOWED_HOSTS: "sei.tjmsp.jus.br",
    SESSION_SECRET: "test-session-secret-is-long-enough-12345",
    SECRET_ENCRYPTION_KEY: "test-independent-encryption-key-12345678",
  };
  return { db, repo, env };
}
const token = async (
  email = owner,
  aud = "private-test-audience",
  expiry = "1h",
  tokenIssuer = issuer,
) =>
  new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setSubject("test-user")
    .setIssuer(tokenIssuer)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(privateKey);
const call = (env, path, jwt, method = "GET", body, headers = {}) =>
  fetchHandler(
    new Request("https://private.test" + path, {
      method,
      headers: {
        ...(jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {}),
        "Content-Type": "application/json",
        Origin: "https://private.test",
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    env,
  );
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  assert.equal(String(url), issuer + "/cdn-cgi/access/certs");
  return Response.json({ keys: [jwk] });
};
test.after(() => {
  globalThis.fetch = originalFetch;
});

test("privado bloqueia HTML, assets, API, health e cookies legados sem Access", async () => {
  const { db, env } = await fixture();
  for (const path of [
    "/",
    "/app.js",
    "/api/health",
    "/api/dashboard",
    "/api/settings",
  ]) {
    const r = await call(env, path, undefined, "GET", undefined, {
      Cookie: "siga_session=forged",
      "Cf-Access-Authenticated-User-Email": owner,
    });
    assert.equal(r.status, 403);
    assert.equal(r.headers.get("Cache-Control"), "no-store");
  }
  db.close();
});
test("privado valida assinatura, audiência, emissor, expiração e lista de e-mails", async () => {
  const { db, env } = await fixture();
  for (const jwt of [
    "forged",
    await token(owner, "other-app"),
    await token(owner, "private-test-audience", "-1s"),
    await token("stranger@example.test"),
    await token(
      owner,
      "private-test-audience",
      "1h",
      "https://other.cloudflareaccess.com",
    ),
  ])
    assert.equal((await call(env, "/api/session", jwt)).status, 403);
  const jwt = await token();
  const r = await call(env, "/api/session", jwt);
  assert.equal(r.status, 200);
  const s = await r.json();
  assert.equal(s.actor.id, "u-gestor");
  assert.equal(s.accessProtected, true);
  assert.equal(s.authenticated, true);
  assert(!JSON.stringify(s).includes(jwt));
  assert(!JSON.stringify(s).includes(env.SECRET_ENCRYPTION_KEY));
  assert.equal((await call(env, "/", jwt)).status, 200);
  db.close();
});
test("privado falha fechado se configuração fica pública ou incompleta", async () => {
  const { db, env } = await fixture();
  for (const changes of [
    { PUBLIC_DEMO: "true" },
    { ACCESS_REQUIRED: "false" },
    { ACCESS_AUD: "" },
    { ACCESS_ALLOWED_EMAILS: "" },
  ])
    assert.equal(
      (await call({ ...env, ...changes }, "/api/health", await token())).status,
      503,
    );
  db.close();
});

test("publicação sem modo explícito ou em desenvolvimento remoto falha fechada", async () => {
  const { db, env } = await fixture();
  for (const mode of [undefined, "development", "invalid"])
    assert.equal(
      (await call({ ...env, DEPLOYMENT_MODE: mode }, "/api/health")).status,
      503,
    );
  db.close();
});
test("privado aplica cadastro ativo e papéis atuais em cada requisição", async () => {
  const { db, env } = await fixture();
  const jwt = await token();
  await db.prepare("UPDATE users SET active=0 WHERE id='u-gestor'").run();
  assert.equal((await call(env, "/api/session", jwt)).status, 403);
  db.close();
});
test("privado exige CSRF e origem mesmo com Access válido; não aceita login por senha nem seed", async () => {
  const { db, env } = await fixture();
  const jwt = await token();
  assert.equal(
    (await call(env, "/api/demands", jwt, "POST", { title: "TEST" })).status,
    403,
  );
  assert.equal(
    (
      await call(env, "/api/login", jwt, "POST", {
        account: "gestor",
        password: "wrong",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call(env, "/api/initialize", jwt, "POST", {})).status,
    403,
  );
  const { csrf } = await (await call(env, "/api/session", jwt)).json();
  assert.equal(
    (
      await call(
        env,
        "/api/logout",
        jwt,
        "POST",
        {},
        { "X-CSRF-Token": csrf, Origin: "https://evil.test" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await call(env, "/api/logout", jwt, "POST", {}, { "X-CSRF-Token": csrf }))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        env,
        "/api/simulate",
        jwt,
        "POST",
        {},
        { "X-CSRF-Token": csrf },
      )
    ).status,
    403,
  );
  await db.prepare("DELETE FROM user_roles WHERE user_id='u-gestor'").run();
  await db
    .prepare("INSERT INTO user_roles VALUES('u-gestor','SDG_LEITOR')")
    .run();
  assert.equal((await call(env, "/api/dashboard", jwt)).status, 200);
  assert.equal(
    (
      await call(
        env,
        "/api/demands",
        jwt,
        "POST",
        { title: "attempt" },
        { "X-CSRF-Token": csrf },
      )
    ).status,
    403,
  );
  db.close();
});
test("token privado usa chave independente, não é devolvido e sobrevive à troca da chave de sessão", async () => {
  const { db, repo, env } = await fixture();
  const jwt = await token();
  await db.prepare("INSERT INTO user_roles VALUES('u-gestor','ADMIN')").run();
  const { csrf } = await (await call(env, "/api/session", jwt)).json();
  const secret = "dummy-private-token-test-123456789";
  assert.equal(
    (
      await call(
        env,
        "/api/settings/ai",
        jwt,
        "POST",
        { token: secret },
        { "X-CSRF-Token": csrf },
      )
    ).status,
    200,
  );
  const row = await db
    .prepare("SELECT value_json FROM app_settings WHERE key='ai_api_key'")
    .first();
  assert(!row.value_json.includes(secret));
  assert.equal(JSON.parse(row.value_json).keyVersion, 2);
  assert(
    !(await (await call(env, "/api/settings", jwt)).text()).includes(secret),
  );
  const active = {
    ...env,
    SESSION_SECRET: "rotated-independent-session-key",
    SIMULATION_MODE: "false",
    AI_PROVIDER: "openai",
  };
  assert.equal((await configuredAi(active, repo)).AI_API_KEY, secret);
  assert.equal(
    (
      await configuredAi(
        { ...active, AI_API_KEY: "secret-from-cloudflare" },
        repo,
      )
    ).AI_API_KEY,
    "secret-from-cloudflare",
  );
  db.close();
});
test("demonstração pública rejeita gravações, login, seed e credenciais", async () => {
  const { db, env } = await fixture();
  const demo = {
    ...env,
    DEPLOYMENT_MODE: "demo",
    ACCESS_REQUIRED: "false",
    PUBLIC_DEMO: "true",
  };
  // A private database must never become readable through a demo deployment.
  assert.equal((await call(demo, "/api/dashboard")).status, 503);
  await db
    .prepare(
      "UPDATE app_settings SET value_json=? WHERE key='deployment_identity'",
    )
    .bind(JSON.stringify({ mode: "demo" }))
    .run();
  const before = await db
    .prepare("SELECT count(*) n FROM security_events")
    .first();
  for (const path of [
    "/api/login",
    "/api/initialize",
    "/api/settings/ai",
    "/api/directory",
    "/api/demands",
  ])
    assert.equal(
      (await call(demo, path, undefined, "POST", { token: "dummy-secret" }))
        .status,
      403,
    );
  assert.equal((await call(demo, "/api/dashboard")).status, 200);
  const s = await (
    await call(demo, "/api/session", undefined, "GET", undefined, {
      Cookie: "siga_session=forged",
    })
  ).json();
  assert.equal(s.authenticated, false);
  assert.deepEqual(s.actor.roles, ["SDG_LEITOR"]);
  await scheduledHandler({}, demo);
  assert.deepEqual(
    await db.prepare("SELECT count(*) n FROM security_events").first(),
    before,
  );
  for (const change of [
    { AI_API_KEY: "accidental-token" },
    { GOOGLE_REFRESH_TOKEN: "accidental-token" },
    { SIMULATION_MODE: "false" },
    { AI_PROVIDER: "openai" },
    { EMAIL_SEND_ENABLED: "true" },
  ])
    assert.equal(
      (await call({ ...demo, ...change }, "/api/dashboard")).status,
      503,
    );
  db.close();
});
