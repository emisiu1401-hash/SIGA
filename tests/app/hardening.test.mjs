import test from "node:test";
import assert from "node:assert/strict";
import { LocalD1 } from "../../scripts/sqlite.mjs";
import {
  Repository,
  seedDirectory,
  demoPeople,
  createAggregate,
  transition,
  activeAssignment,
  freshText,
  synchronizeGmail,
  configuredAi,
  encryptSecret,
  fetchHandler,
  dashboard,
} from "../../dist/testing.js";
const at = "2026-10-23T12:00:00Z";
const apply = (s, type, p = demoPeople[0], extra = {}) =>
  transition(
    s,
    { id: crypto.randomUUID(), type, expectedVersion: s.version, ...extra },
    p,
    demoPeople,
    at,
  ).state;
function assigned() {
  let s = createAggregate(
    "hardening-demand",
    "SIGA-2026-0001",
    "Vistoria fictícia",
    "",
    demoPeople[0].id,
    at,
  );
  s = apply(s, "CREATE");
  s = apply(s, "ASSIGN", demoPeople[0], {
    personId: demoPeople[1].id,
    priority: "ALTA",
  });
  return apply(s, "ACCEPT", demoPeople[1], { date: "2026-10-26" });
}
test("snapshots de auditoria são imutáveis e preservam antes/depois reais", () => {
  let s = assigned();
  s = apply(s, "EXTENSION", demoPeople[1], {
    date: "2026-10-30",
    reason: "Aguardar terceiro",
  });
  const initial = JSON.stringify(s.events);
  s = apply(s, "DECIDE", demoPeople[0], {
    requestId: s.requests[0].id,
    decision: "APPROVE",
  });
  assert.equal(s.events.at(-1).before.assignment.due, "2026-10-26");
  assert.equal(s.events.at(-1).after.assignment.due, "2026-10-30");
  assert.equal(JSON.stringify(s.events.slice(0, -1)), initial);
});
test("destinatário de transferência pendente não altera impedimento ou trabalho antes do aceite", () => {
  let s = assigned();
  s = apply(s, "TRANSFER", demoPeople[1], {
    personId: demoPeople[4].id,
    reason: "Competência da engenharia",
  });
  s = apply(s, "DECIDE", demoPeople[0], {
    requestId: s.requests[0].id,
    decision: "APPROVE",
  });
  for (const type of ["BLOCK", "TIME", "TRANSFER", "SUPPORT"])
    assert.throws(
      () =>
        apply(s, type, demoPeople[4], {
          reason: "Tentativa prematura",
          minutes: 60,
          personId: demoPeople[2].id,
        }),
      (e) => e.code === "FORBIDDEN",
    );
  assert.equal(activeAssignment(s).personId, demoPeople[1].id);
});
test("HTML malformado é limitado antes da limpeza, sem rescaneamento quadrático", () => {
  const huge = "<blockquote".repeat(30000);
  const start = performance.now();
  assert.equal(freshText(huge), "");
  assert(performance.now() - start < 1000);
  assert.equal(
    freshText("Texto novo\n> Texto citado SIGA-2026-1234"),
    "Texto novo",
  );
});
test("decisões independentes A depois B no painel preservam validade do par", () => {
  let s = assigned();
  s = apply(s, "DECLARE", demoPeople[1], {
    reason: "Vistoria concluída; reparo independente",
    createChild: true,
    title: "Reparo",
  });
  s = apply(s, "DOCUMENT", demoPeople[1]);
  const close = s.requests.find((r) => r.type === "CONCLUSAO");
  s = apply(s, "DECIDE", demoPeople[0], {
    requestId: close.id,
    decision: "APPROVE",
  });
  const child = s.requests.find((r) => r.type === "DEMANDA_FILHA");
  assert.equal(child.expectedVersion, s.version);
  const next = transition(
    s,
    {
      id: crypto.randomUUID(),
      type: "DECIDE",
      expectedVersion: s.version,
      requestId: child.id,
      decision: "APPROVE",
      childId: "child-pair",
      childCode: "SIGA-2026-0002",
    },
    demoPeople[0],
    demoPeople,
    at,
  );
  assert.equal(next.state.status, "ENCERRADA");
  assert.equal(next.children.length, 1);
});
test("Gmail: mensagem >500KB é isolada e mensagem seguinte é importada; cursor avança", async () => {
  const db = new LocalD1();
  db.migrate();
  const repo = new Repository(db);
  await seedDirectory(repo);
  await db
    .prepare(
      "INSERT INTO gmail_sync_state(id,history_id,last_sync_at) VALUES('primary','100',?)",
    )
    .bind(at)
    .run();
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u === "https://oauth2.googleapis.com/token")
      return Response.json({ access_token: "dummy-test-access-token" });
    if (u.endsWith("/profile"))
      return Response.json({
        emailAddress: "mailbox@example.invalid",
        historyId: "200",
      });
    if (u.includes("/history?"))
      return Response.json({
        history: [
          {
            messagesAdded: [
              { message: { id: "oversize" } },
              { message: { id: "normal" } },
            ],
          },
        ],
      });
    if (u.includes("/messages/oversize"))
      return new Response("x".repeat(500001));
    if (u.includes("/messages/normal"))
      return Response.json({
        id: "normal",
        threadId: "thread-normal",
        internalDate: String(Date.now()),
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "From", value: "solicitante@example.invalid" },
            { name: "Subject", value: "Mensagem normal de teste" },
          ],
          body: {
            data: Buffer.from("Solicito revisão de atividade.").toString(
              "base64url",
            ),
          },
        },
      });
    throw new Error("Unexpected mocked URL");
  };
  try {
    const result = await synchronizeGmail(repo, {
      SIMULATION_MODE: "false",
      AI_PROVIDER: "mock",
      GOOGLE_CLIENT_ID: "dummy-test-client-id",
      GOOGLE_CLIENT_SECRET: "dummy-test-client-secret",
      GOOGLE_REFRESH_TOKEN: "dummy-test-refresh-token",
      MAILBOX_ID: "mailbox@example.invalid",
    });
    assert.equal(result.imported, 2);
    const rows = (await db.prepare("SELECT * FROM ingestion_reviews").all())
      .results;
    assert(
      rows.some(
        (r) =>
          r.provider_message_id === "oversize" &&
          r.reason.includes("lote continua"),
      ),
    );
    assert(rows.some((r) => r.provider_message_id === "normal"));
    assert.equal(
      (
        await db
          .prepare("SELECT history_id FROM gmail_sync_state WHERE id='primary'")
          .first()
      ).history_id,
      "200",
    );
    assert.equal(calls.length, 5);
  } finally {
    globalThis.fetch = original;
    db.close();
  }
});
test("token salvo no painel é carregado pelo interpretador real e nunca em simulação", async () => {
  const db = new LocalD1();
  db.migrate();
  const repo = new Repository(db),
    secret = "dummy-encryption-key-for-unit-tests-000000";
  const encrypted = await encryptSecret("dummy-openai-token-for-test", secret);
  await db
    .prepare("INSERT INTO app_settings VALUES('ai_api_key',?,?)")
    .bind(JSON.stringify({ encrypted }), at)
    .run();
  const env = {
    SIMULATION_MODE: "false",
    AI_PROVIDER: "openai",
    SESSION_SECRET: secret,
  };
  assert.equal(
    (await configuredAi(env, repo)).AI_API_KEY,
    "dummy-openai-token-for-test",
  );
  assert.equal(
    (await configuredAi({ ...env, SIMULATION_MODE: "true" }, repo)).AI_API_KEY,
    undefined,
  );
  db.close();
});
test("triagem de entrada real exige gestor autenticado e não cria duplicata", async () => {
  const db = new LocalD1();
  db.migrate();
  const repo = new Repository(db);
  await seedDirectory(repo);
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO ingestion_reviews VALUES(?,?,?,?,?,?,?)")
    .bind(
      id,
      "provider-review-1",
      "solicitante@example.invalid",
      "Vistoria solicitada",
      "Texto não confiável",
      "Revisão necessária",
      at,
    )
    .run();
  const env = {
    DB: db,
    DEPLOYMENT_MODE: "development",
    SIMULATION_MODE: "true",
    PUBLIC_DEMO: "true",
    SESSION_SECRET: "dummy-test-session-key-that-is-long-enough",
    MANAGER_PASSWORD: "dummy-manager-password",
    ADMIN_PASSWORD: "dummy-admin-password",
    SEI_ALLOWED_HOSTS: "sei.tjmsp.jus.br",
  };
  const call = (path, body, headers = {}) =>
    fetchHandler(
      new Request("http://localhost" + path, {
        method: "POST",
        headers: {
          Origin: "http://localhost",
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      }),
      env,
    );
  assert.equal((await call("/api/reviews/" + id + "/triage", {})).status, 403);
  const login = await call("/api/login", {
      account: "gestor",
      password: env.MANAGER_PASSWORD,
    }),
    cookie = login.headers.get("Set-Cookie").split(";")[0],
    csrf = (await login.json()).csrf;
  const headers = { Cookie: cookie, "X-CSRF-Token": csrf };
  const first = await call("/api/reviews/" + id + "/triage", {}, headers);
  assert.equal(first.status, 201);
  const saved = await first.json();
  const second = await call("/api/reviews/" + id + "/triage", {}, headers);
  assert.equal((await second.json()).id, saved.id);
  assert.equal(db.raw.prepare("SELECT count(*) n FROM demands").get().n, 1);
  assert.equal(
    db.raw.prepare("SELECT origin FROM demands").get().origin,
    "EMAIL",
  );
  db.close();
});
test("CA-69: 2500 demandas, métricas coerentes e apenas 12 linhas por página", async () => {
  const db = new LocalD1();
  db.migrate();
  const repo = new Repository(db);
  await seedDirectory(repo);
  const d = db.raw.prepare(
      "INSERT INTO demands(id,code,title,description,origin,manager_id,status,priority,opened_at,version) VALUES(?,?,?,'','DASHBOARD','u-gestor','NOVA_TRIAGEM',NULL,?,1)",
    ),
    g = db.raw.prepare("INSERT INTO siga_aggregates VALUES(?,1,?)");
  db.raw.exec("BEGIN");
  for (let i = 0; i < 2500; i++) {
    const s = createAggregate(
      "mass-" + i,
      "SIGA-2026-" + String(1000 + i),
      "Demanda sintética " + i,
      "",
      "u-gestor",
      at,
    );
    s.version = 1;
    d.run(s.id, s.code, s.title, at);
    g.run(s.id, JSON.stringify(s));
  }
  db.raw.exec("COMMIT");
  const start = performance.now(),
    result = await dashboard(
      repo,
      new URLSearchParams("size=12&page=2"),
      demoPeople[5],
      at,
      { SIMULATION_MODE: "true", SEI_ALLOWED_HOSTS: "sei.tjmsp.jus.br" },
    );
  assert.equal(result.total, 2500);
  assert.equal(result.rows.length, 12);
  assert.equal(result.kpis.active, 2500);
  assert.equal(
    result.sections.reduce((n, s) => n + s.total, 0),
    2500,
  );
  assert(performance.now() - start < 5000);
  db.close();
});
