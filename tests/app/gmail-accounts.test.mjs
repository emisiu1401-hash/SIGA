import test from "node:test";
import assert from "node:assert/strict";
import { LocalD1 } from "../../scripts/sqlite.mjs";
import {
  Repository,
  seedDirectory,
  startGmailOAuth,
  finishGmailOAuth,
  gmailAccountStatus,
  gmailOutboxId,
  configuredGmail,
  gmailOperation,
  activateGmailAccount,
  dispatchMail,
  synchronizeGmail,
} from "../../dist/testing.js";

const READ = "https://www.googleapis.com/auth/gmail.readonly",
  SEND = "https://www.googleapis.com/auth/gmail.send";
const first = "personal-sender@example.test",
  second = "institutional-sender@example.test";
const origin = "https://siga-private.example.test";
const actor = "u-admin";
async function setup() {
  const db = new LocalD1();
  db.migrate();
  const repo = new Repository(db);
  await seedDirectory(repo);
  const env = {
    DB: db,
    DEPLOYMENT_MODE: "private",
    PUBLIC_DEMO: "false",
    ACCESS_REQUIRED: "true",
    SIMULATION_MODE: "true",
    AI_PROVIDER: "mock",
    EMAIL_SEND_ENABLED: "false",
    GOOGLE_CLIENT_ID: "dummy-client.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "dummy-oauth-client-secret",
    SECRET_ENCRYPTION_KEY: "dummy-independent-protection-key-1234567890",
    GOOGLE_OAUTH_REDIRECT_URI: origin + "/api/gmail/oauth/callback",
    OUTBOX_MAILBOX_ID: "mock-mailbox",
    SEI_ALLOWED_HOSTS: "sei.tjmsp.jus.br",
  };
  let mailbox = first,
    history = "100",
    responseScopes = READ + " " + SEND,
    refresh = "dummy-refresh-first-123456789",
    omitRefresh = false;
  const sent = [];
  let calls = 0;
  const old = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls++;
    if (String(url) === "https://oauth2.googleapis.com/token")
      return Response.json({
        access_token: "dummy-google-access-token",
        ...(omitRefresh ? {} : { refresh_token: refresh }),
        scope: responseScopes,
      });
    if (String(url).endsWith("/profile"))
      return Response.json({ emailAddress: mailbox, historyId: history });
    if (String(url).includes("/history?"))
      return Response.json({
        history: [
          { messagesAdded: [{ message: { id: "shared-provider-id" } }] },
        ],
      });
    if (String(url).includes("/messages/shared-provider-id"))
      return Response.json({
        id: "shared-provider-id",
        threadId: "thread-shared",
        payload: {
          mimeType: "text/plain",
          headers: [{ name: "From", value: "requester@example.test" }],
          body: {
            data: Buffer.from("Mensagem fictícia para revisão").toString(
              "base64url",
            ),
          },
        },
      });
    if (String(url).endsWith("/messages/send")) {
      sent.push(JSON.parse(options.body));
      return Response.json({ id: "sent-test-id" });
    }
    throw Error("Unexpected external URL in test");
  };
  const begin = async (email = mailbox, allowSend = true) => {
    const result = await startGmailOAuth(
      new Request(origin + "/api/settings/gmail/connect"),
      env,
      repo,
      actor,
      { email, allowSend },
    );
    const state = new URL(result.authorizationUrl).searchParams.get("state");
    return {
      ...result,
      state,
      request: new Request(
        env.GOOGLE_OAUTH_REDIRECT_URI +
          "?state=" +
          state +
          "&code=dummy-authorization-code",
        { headers: { Cookie: result.cookie.split(";")[0] } },
      ),
    };
  };
  const connect = async (email = mailbox, allowSend = true) => {
    mailbox = email;
    const p = await begin(email, allowSend);
    await finishGmailOAuth(p.request, env, repo, actor);
    return gmailAccountStatus(repo, env);
  };
  const activate = async () => {
    const s = await gmailAccountStatus(repo, env);
    await activateGmailAccount(
      repo,
      { ...env, SIMULATION_MODE: "false" },
      actor,
      { connectionId: s.connectionId, version: s.version },
    );
    return configuredGmail(repo, {
      ...env,
      SIMULATION_MODE: "false",
      EMAIL_SEND_ENABLED: "true",
    });
  };
  return {
    db,
    repo,
    env,
    begin,
    connect,
    activate,
    sent,
    get calls() {
      return calls;
    },
    setMailbox(v) {
      mailbox = v;
    },
    setHistory(v) {
      history = v;
    },
    setScopes(v) {
      responseScopes = v;
    },
    setOmitRefresh(v) {
      omitRefresh = v;
    },
    cleanup() {
      globalThis.fetch = old;
      db.close();
    },
  };
}
async function pending(db, id, mailbox) {
  await db
    .prepare(
      "INSERT INTO outbound_messages(id,mailbox_id,recipient_email,subject,body_text,status,dedupe_key,created_at) VALUES(?,?,?,'Teste','Corpo fictício','PENDENTE',?,?)",
    )
    .bind(id, mailbox, "recipient@example.org", id, new Date().toISOString())
    .run();
}

test("conexão Gmail usa state, cookie HttpOnly/Lax e PKCE, sem expor o segredo do cliente", async () => {
  const f = await setup();
  try {
    const p = await f.begin(first, false),
      url = new URL(p.authorizationUrl);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("scope"), READ);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert(url.searchParams.get("code_challenge"));
    assert.match(p.cookie, /HttpOnly; SameSite=Lax/);
    assert.match(p.cookie, /Secure/);
    assert(!p.authorizationUrl.includes(f.env.GOOGLE_CLIENT_SECRET));
    assert(!p.authorizationUrl.includes("code_verifier"));
    const row = await f.db
      .prepare("SELECT * FROM gmail_oauth_requests")
      .first();
    assert.notEqual(row.state_hash, p.state);
    assert(!row.verifier_cipher.includes(p.state));
    assert.equal(f.calls, 0);
    await assert.rejects(
      startGmailOAuth(
        new Request("https://other.example.test/api/settings/gmail/connect"),
        f.env,
        f.repo,
        actor,
        { email: first },
      ),
      (e) => e.code === "GMAIL_REDIRECT",
    );
  } finally {
    f.cleanup();
  }
});
test("primeira conexão valida identidade, cifra refresh token e pausa sem modificar login", async () => {
  const f = await setup();
  try {
    const before = await f.repo.people();
    const s = await f.connect();
    assert.equal(s.email, first);
    assert.equal(s.paused, true);
    assert.equal(s.connected, true);
    const row = await f.db.prepare("SELECT * FROM gmail_connections").first();
    assert(!row.refresh_token_cipher.includes("dummy-refresh"));
    assert(!JSON.stringify(s).includes("dummy-refresh"));
    assert(!JSON.stringify(s).includes("dummy-oauth"));
    const effective = await configuredGmail(f.repo, f.env);
    assert.equal(effective.MAILBOX_ID, first);
    assert.equal(effective.SIMULATION_MODE, "true");
    assert.equal(effective.EMAIL_SEND_ENABLED, "false");
    assert.equal(
      effective.GOOGLE_REFRESH_TOKEN,
      "dummy-refresh-first-123456789",
    );
    assert.equal(await gmailOutboxId(f.repo, f.env), row.mailbox_id);
    assert.deepEqual(await f.repo.people(), before);
    assert.equal(
      (await f.db.prepare("SELECT count(*) n FROM demands").first()).n,
      0,
    );
    assert.equal(
      (
        await f.db
          .prepare("SELECT history_id FROM gmail_sync_state WHERE id=?")
          .bind(row.mailbox_id)
          .first()
      ).history_id,
      "100",
    );
  } finally {
    f.cleanup();
  }
});
test("troca A para B conserva cursores separados e retém mensagens pendentes sem transferi-las", async () => {
  const f = await setup();
  try {
    await f.connect(first);
    const boxA = await gmailOutboxId(f.repo, f.env);
    await pending(f.db, "old-message", boxA);
    f.setHistory("200");
    const s = await f.connect(second);
    const boxB = await gmailOutboxId(f.repo, f.env);
    assert.notEqual(boxA, boxB);
    assert.equal(s.email, second);
    assert.equal(s.heldMessages, 1);
    assert.equal(s.paused, true);
    const message = await f.db
      .prepare("SELECT * FROM outbound_messages WHERE id='old-message'")
      .first();
    assert.equal(message.mailbox_id, boxA);
    assert.equal(message.status, "ERRO");
    assert.match(message.failure_reason, /CONTA_ALTERADA/);
    assert.equal(
      (
        await f.db
          .prepare("SELECT history_id FROM gmail_sync_state WHERE id=?")
          .bind(boxA)
          .first()
      ).history_id,
      "100",
    );
    assert.equal(
      (
        await f.db
          .prepare("SELECT history_id FROM gmail_sync_state WHERE id=?")
          .bind(boxB)
          .first()
      ).history_id,
      "200",
    );
    assert.equal(
      (await f.db.prepare("SELECT count(*) n FROM gmail_connections").first())
        .n,
      1,
    );
    assert.equal(f.sent.length, 0);
  } finally {
    f.cleanup();
  }
});
test("conta diferente da informada mantém a conexão anterior e não toca a fila", async () => {
  const f = await setup();
  try {
    const original = await f.connect(first),
      p = await f.begin(second);
    f.setMailbox(first);
    await assert.rejects(
      finishGmailOAuth(p.request, f.env, f.repo, actor),
      (e) => e.code === "MAILBOX_MISMATCH",
    );
    assert.equal(
      (await gmailAccountStatus(f.repo, f.env)).connectionId,
      original.connectionId,
    );
    assert.equal(
      (await f.db.prepare("SELECT count(*) n FROM gmail_connections").first())
        .n,
      1,
    );
  } finally {
    f.cleanup();
  }
});
test("state sem cookie, expirado, usado ou pertencente a outro ator não conecta", async () => {
  const f = await setup();
  try {
    const p = await f.begin();
    await assert.rejects(
      finishGmailOAuth(new Request(p.request.url), f.env, f.repo, actor),
      (e) => e.code === "GMAIL_OAUTH_STATE",
    );
    await assert.rejects(
      finishGmailOAuth(p.request, f.env, f.repo, "u-gestor"),
      (e) => e.code === "GMAIL_OAUTH_STATE",
    );
    await f.db.prepare("UPDATE gmail_oauth_requests SET expires_at=0").run();
    await assert.rejects(
      finishGmailOAuth(p.request, f.env, f.repo, actor),
      (e) => e.code === "GMAIL_OAUTH_STATE",
    );
    const fresh = await f.begin();
    await finishGmailOAuth(fresh.request, f.env, f.repo, actor);
    await assert.rejects(
      finishGmailOAuth(fresh.request, f.env, f.repo, actor),
      (e) => e.code === "GMAIL_OAUTH_STATE",
    );
  } finally {
    f.cleanup();
  }
});
test("consentimento cancelado, refresh ausente e escopos insuficientes não substituem a conta", async () => {
  const f = await setup();
  try {
    const original = await f.connect(first);
    let p = await f.begin(second);
    const cancelled = new URL(p.request.url);
    cancelled.searchParams.set("error", "access_denied");
    await assert.rejects(
      finishGmailOAuth(
        new Request(cancelled, { headers: p.request.headers }),
        f.env,
        f.repo,
        actor,
      ),
      (e) => e.code === "GMAIL_OAUTH_CANCELLED",
    );
    f.setMailbox(second);
    f.setOmitRefresh(true);
    p = await f.begin(second);
    await assert.rejects(
      finishGmailOAuth(p.request, f.env, f.repo, actor),
      (e) => e.code === "GMAIL_OAUTH_REFRESH",
    );
    f.setOmitRefresh(false);
    f.setScopes(READ);
    p = await f.begin(second, true);
    await assert.rejects(
      finishGmailOAuth(p.request, f.env, f.repo, actor),
      (e) => e.code === "GMAIL_OAUTH_SCOPES",
    );
    assert.equal(
      (await gmailAccountStatus(f.repo, f.env)).connectionId,
      original.connectionId,
    );
  } finally {
    f.cleanup();
  }
});
test("autorizações simultâneas não sobrescrevem a troca já confirmada", async () => {
  const f = await setup();
  try {
    const a = await f.begin(first),
      b = await f.begin(second);
    f.setMailbox(first);
    await finishGmailOAuth(a.request, f.env, f.repo, actor);
    f.setMailbox(second);
    await assert.rejects(
      finishGmailOAuth(b.request, f.env, f.repo, actor),
      (e) => e.code === "GMAIL_BUSY",
    );
    assert.equal((await gmailAccountStatus(f.repo, f.env)).email, first);
  } finally {
    f.cleanup();
  }
});
test("operação em andamento bloqueia troca; retomada exige versão atual e plataforma ativa", async () => {
  const f = await setup();
  try {
    const s = await f.connect(first);
    await assert.rejects(
      activateGmailAccount(f.repo, f.env, actor, {
        connectionId: s.connectionId,
        version: s.version,
      }),
      (e) => e.code === "GMAIL_SIMULATION",
    );
    await assert.rejects(
      activateGmailAccount(
        f.repo,
        { ...f.env, SIMULATION_MODE: "false" },
        actor,
        { connectionId: s.connectionId, version: 0 },
      ),
      (e) => e.code === "GMAIL_STALE",
    );
    const effective = await f.activate();
    const p = await f.begin(second);
    const op = await gmailOperation(f.repo, effective);
    try {
      await assert.rejects(f.begin(second), (e) => e.code === "GMAIL_BUSY");
      f.setMailbox(second);
      await assert.rejects(
        finishGmailOAuth(p.request, f.env, f.repo, actor),
        (e) => e.code === "GMAIL_BUSY",
      );
    } finally {
      await op.release();
    }
    assert.equal((await gmailAccountStatus(f.repo, f.env)).email, first);
  } finally {
    f.cleanup();
  }
});
test("reconexão sem solicitar envio não usa permissões antigas mais amplas", async () => {
  const f = await setup();
  try {
    await f.connect(first, false);
    const effective = await f.activate();
    assert.equal(effective.EMAIL_SEND_ENABLED, "false");
  } finally {
    f.cleanup();
  }
});
test("envio confirma perfil Google e seleciona somente a fila da caixa ativa", async () => {
  const f = await setup();
  try {
    await f.connect(first);
    const box = await gmailOutboxId(f.repo, f.env),
      effective = await f.activate();
    await pending(f.db, "active-mail", box);
    await pending(f.db, "other-mail", "mock-mailbox");
    assert.equal((await dispatchMail(f.repo, effective)).sent, 1);
    assert.equal(f.sent.length, 1);
    const text = Buffer.from(f.sent[0].raw, "base64url").toString();
    assert(text.includes("From: " + first));
    assert.equal(
      (
        await f.db
          .prepare("SELECT status FROM outbound_messages WHERE id='other-mail'")
          .first()
      ).status,
      "PENDENTE",
    );
    await pending(f.db, "mismatched-mail", box);
    f.setMailbox(second);
    await assert.rejects(
      dispatchMail(f.repo, effective),
      (e) => e.code === "MAILBOX_MISMATCH",
    );
    assert.equal(
      (
        await f.db
          .prepare(
            "SELECT status FROM outbound_messages WHERE id='mismatched-mail'",
          )
          .first()
      ).status,
      "PENDENTE",
    );
  } finally {
    f.cleanup();
  }
});
test("mesmo ID de mensagem em duas contas é revisado separadamente", async () => {
  const f = await setup();
  try {
    await f.connect(first);
    let effective = await f.activate();
    f.setHistory("150");
    assert.equal((await synchronizeGmail(f.repo, effective)).imported, 1);
    f.setHistory("200");
    await f.connect(second);
    effective = await f.activate();
    f.setHistory("250");
    assert.equal((await synchronizeGmail(f.repo, effective)).imported, 1);
    const rows = (
      await f.db
        .prepare("SELECT mailbox_id,provider_message_id FROM ingestion_reviews")
        .all()
    ).results;
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].mailbox_id, rows[1].mailbox_id);
    assert.equal(rows[0].provider_message_id, rows[1].provider_message_id);
  } finally {
    f.cleanup();
  }
});

test("falhas Google são identificadas sem registrar payloads ou substituir a conta anterior", async () => {
  for (const [status, payload, profile, expected] of [
    [
      400,
      {
        error: "invalid_client",
        error_description: "private-provider-description",
      },
      false,
      "GMAIL_OAUTH_CLIENT",
    ],
    [400, { error: "invalid_grant" }, false, "GMAIL_OAUTH_EXPIRED"],
    [
      500,
      "<html>private-provider-description</html>",
      false,
      "GMAIL_PROVIDER_UNAVAILABLE",
    ],
    [
      200,
      "<html>private-provider-description</html>",
      false,
      "GMAIL_OAUTH_RESPONSE",
    ],
    [200, null, false, "GMAIL_OAUTH_RESPONSE"],
    [
      403,
      {
        error: {
          details: [
            {
              reason: "SERVICE_DISABLED",
              metadata: { secret: "private-provider-description" },
            },
          ],
        },
      },
      true,
      "GMAIL_API_DISABLED",
    ],
    [
      403,
      { error: { errors: [{ reason: "accessNotConfigured" }] } },
      true,
      "GMAIL_API_DISABLED",
    ],
    [
      403,
      { error: { errors: [{ reason: "forbidden" }] } },
      true,
      "GMAIL_PROFILE",
    ],
  ]) {
    const f = await setup();
    try {
      const previous = await f.connect(first),
        p = await f.begin(second);
      const provider = globalThis.fetch;
      globalThis.fetch = async (url, options) =>
        String(url).endsWith(profile ? "/profile" : "/token")
          ? typeof payload === "string"
            ? new Response(payload, { status })
            : Response.json(payload, { status })
          : provider(url, options);
      await assert.rejects(
        finishGmailOAuth(p.request, f.env, f.repo, actor),
        (e) => e.code === expected,
      );
      assert.equal(
        (await gmailAccountStatus(f.repo, f.env)).connectionId,
        previous.connectionId,
      );
      const failure = await f.db
        .prepare(
          "SELECT details_json FROM audit_log WHERE action='GMAIL_OAUTH_FAILED' ORDER BY occurred_at DESC LIMIT 1",
        )
        .first();
      assert.equal(JSON.parse(failure.details_json).code, expected);
      assert(!failure.details_json.includes("private-provider-description"));
      assert(!failure.details_json.includes("dummy-"));
      assert.equal(
        (
          await f.db
            .prepare(
              "SELECT count(*) n FROM gmail_oauth_requests WHERE status='FAILED' AND verifier_cipher=''",
            )
            .first()
        ).n,
        1,
      );
      assert.equal(
        (await f.db.prepare("SELECT busy_until FROM gmail_control").first())
          .busy_until,
        0,
      );
    } finally {
      f.cleanup();
    }
  }
});

test("falhas de rede, proteção e transação são separadas e preservam a conexão", async () => {
  for (const stage of ["network", "protection", "storage"]) {
    const f = await setup();
    try {
      const previous = await f.connect(first),
        p = await f.begin(second);
      f.setMailbox(second);
      const rawBatch = f.db.batch.bind(f.db);
      if (stage === "network")
        globalThis.fetch = async () => {
          throw new TypeError("private-provider-description");
        };
      if (stage === "protection")
        f.env.SECRET_ENCRYPTION_KEY =
          "different-test-protection-key-1234567890";
      if (stage === "storage")
        f.db.batch = async () => {
          throw Error("D1_TYPE_ERROR private-provider-description");
        };
      const expected = {
        network: "GMAIL_OAUTH_NETWORK",
        protection: "GMAIL_OAUTH_PROTECTION",
        storage: "GMAIL_OAUTH_STORAGE",
      }[stage];
      await assert.rejects(
        finishGmailOAuth(p.request, f.env, f.repo, actor),
        (e) => e.code === expected,
      );
      f.db.batch = rawBatch;
      assert.equal(
        (await gmailAccountStatus(f.repo, f.env)).connectionId,
        previous.connectionId,
      );
      const failure = await f.db
        .prepare(
          "SELECT details_json FROM audit_log WHERE action='GMAIL_OAUTH_FAILED' ORDER BY occurred_at DESC LIMIT 1",
        )
        .first();
      assert.equal(JSON.parse(failure.details_json).code, expected);
      assert(!failure.details_json.includes("private-provider-description"));
      assert(!failure.details_json.includes("dummy-"));
      await assert.rejects(
        finishGmailOAuth(p.request, f.env, f.repo, actor),
        (e) => e.code === "GMAIL_OAUTH_STATE",
      );
    } finally {
      f.cleanup();
    }
  }
});
