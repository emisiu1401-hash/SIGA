import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LocalD1 } from "../../scripts/sqlite.mjs";
import {
  Repository,
  seedDirectory,
  demoPeople,
  createAggregate,
  transition,
  writeWorkbook,
  readWorkbook,
  zipStored,
  unzipXml,
  DEMAND_HEADERS,
  PEOPLE_HEADERS,
  previewSpreadsheet,
  applySpreadsheet,
  exportSpreadsheet,
  recordAudit,
  exportAudit,
  fetchHandler,
} from "../../dist/testing.js";
async function setup() {
  const db = new LocalD1();
  db.migrate();
  const repo = new Repository(db, true, "mock-mailbox", "request-test");
  await seedDirectory(repo);
  const people = await repo.people(),
    manager = people.find((p) => p.id === "u-gestor"),
    admin = people.find((p) => p.roles.includes("ADMIN")),
    executor = people.find((p) => p.id === "u-gabriela"),
    env = { DB: db, SEI_ALLOWED_HOSTS: "sei.tjmsp.jus.br" };
  return { db, repo, manager, admin, executor, env };
}
async function draft(f, id = "one", n = 1) {
  const at = new Date().toISOString();
  let s = createAggregate(
    id,
    `SIGA-2026-${String(n).padStart(4, "0")}`,
    "Demanda original",
    "Descrição fictícia",
    f.manager.id,
    at,
  );
  s = transition(
    s,
    { id: crypto.randomUUID(), type: "CREATE", expectedVersion: s.version },
    f.manager,
    await f.repo.people(),
    at,
  ).state;
  await f.repo.save(s, null, crypto.randomUUID());
  return s;
}
const workbook = (kind, rows) =>
  writeWorkbook([
    {
      name: kind === "demands" ? "Demandas" : "Pessoas",
      rows: [kind === "demands" ? DEMAND_HEADERS : PEOPLE_HEADERS, ...rows],
    },
  ]);
async function rows(f, kind = "demands") {
  return (
    await readWorkbook(
      new Uint8Array(
        await (await exportSpreadsheet(f.repo, f.manager, kind)).arrayBuffer(),
      ),
      kind === "demands" ? "Demandas" : "Pessoas",
    )
  )
    .slice(1)
    .map((r) => r.values);
}
test("template artifact-tool abre com parser de produção e preserva as colunas", async () => {
  const file = new Uint8Array(
    readFileSync("public/SIGA-modelo-atualizacao.xlsx"),
  );
  for (const [name, headers] of [
    ["Demandas", DEMAND_HEADERS],
    ["Pessoas", PEOPLE_HEADERS],
  ])
    assert.deepEqual((await readWorkbook(file, name))[0].values, headers);
});
test("export/import preserva Unicode e texto literal sem executar fórmulas", async () => {
  const bytes = workbook("people", [
    [
      "",
      "",
      "João & Maria <teste>",
      "joao@example.test",
      "AE",
      "EXECUTOR",
      "SIM",
    ],
  ]);
  const r = await readWorkbook(bytes, "Pessoas");
  assert.equal(r[1].values[2], "João & Maria <teste>");
});
test("prévia não altera demanda; confirmação atualiza projeções e histórico; repetição idempotente", async () => {
  const f = await setup();
  await draft(f);
  const r = await rows(f);
  r[0][3] = "Título atualizado";
  r[0][5] = "ALTA";
  const p = await previewSpreadsheet(
    f.repo,
    f.env,
    f.manager,
    "demands",
    workbook("demands", r),
  );
  assert.equal(p.errors.length, 0);
  assert.equal((await f.repo.get("one")).title, "Demanda original");
  const result = await applySpreadsheet(f.repo, f.env, f.manager, p.previewId);
  assert.equal(result.count, 1);
  const s = await f.repo.get("one");
  assert.equal(s.title, "Título atualizado");
  assert.equal(s.events.at(-1).before.title, "Demanda original");
  assert.equal(s.events.at(-1).after.title, "Título atualizado");
  assert.equal(
    f.db.raw.prepare("SELECT title FROM demands").get().title,
    s.title,
  );
  assert.equal(
    (await applySpreadsheet(f.repo, f.env, f.manager, p.previewId))
      .alreadyApplied,
    true,
  );
  f.db.close();
});
test("versão desatualizada após prévia rejeita lote inteiro", async () => {
  const f = await setup();
  await draft(f);
  await draft(f, "two", 2);
  const r = await rows(f);
  r.forEach((x) => (x[3] = "Atualização em lote"));
  const p = await previewSpreadsheet(
    f.repo,
    f.env,
    f.manager,
    "demands",
    workbook("demands", r),
  );
  const s = await f.repo.get("two");
  const next = transition(
    s,
    {
      id: crypto.randomUUID(),
      type: "PRIORITY",
      priority: "ALTA",
      reason: "Mudança concorrente",
      expectedVersion: s.version,
    },
    f.manager,
    await f.repo.people(),
    new Date().toISOString(),
  ).state;
  await f.repo.save(next, s, crypto.randomUUID());
  await assert.rejects(
    applySpreadsheet(f.repo, f.env, f.manager, p.previewId),
    (e) => e.code === "IMPORT_STALE",
  );
  assert.equal((await f.repo.get("one")).title, "Demanda original");
  f.db.close();
});
test("erro de constraint durante batch desfaz todos os dados e logs de sucesso", async () => {
  const f = await setup();
  await draft(f);
  const r = await rows(f);
  r[0][3] = "Falha atômica";
  const p = await previewSpreadsheet(
    f.repo,
    f.env,
    f.manager,
    "demands",
    workbook("demands", r),
  );
  f.db.raw.exec(
    "CREATE TRIGGER test_fail BEFORE INSERT ON siga_commands BEGIN SELECT RAISE(ABORT,'FAIL_TEST'); END",
  );
  await assert.rejects(applySpreadsheet(f.repo, f.env, f.manager, p.previewId));
  assert.equal((await f.repo.get("one")).title, "Demanda original");
  assert.equal(
    f.db.raw
      .prepare(
        "SELECT count(*) n FROM audit_log WHERE action='SPREADSHEET_APPLIED'",
      )
      .get().n,
    0,
  );
  f.db.close();
});
test("100 pessoas novas por lote usam transação em número constante de queries", async () => {
  const f = await setup();
  const data = Array.from({ length: 100 }, (_, i) => [
    "",
    "",
    "Pessoa " + i,
    `new-${i}@example.test`,
    "AE",
    "EXECUTOR",
    "SIM",
  ]);
  const p = await previewSpreadsheet(
    f.repo,
    f.env,
    f.admin,
    "people",
    workbook("people", data),
  );
  assert.equal(p.errorCount, 0);
  let batchSize = 0;
  const original = f.db.batch.bind(f.db);
  f.db.batch = async (s) => {
    batchSize = s.length;
    return original(s);
  };
  assert.equal(
    (await applySpreadsheet(f.repo, f.env, f.admin, p.previewId)).count,
    100,
  );
  assert.ok(batchSize < 15);
  assert.equal(
    f.db.raw
      .prepare("SELECT count(*) n FROM audit_log WHERE action='PERSON_CREATED'")
      .get().n,
    100,
  );
  f.db.close();
});
test("pessoas: atualiza cadastro, versão e histórico; gestor protegido; duplicatas rejeitadas", async () => {
  const f = await setup();
  const p = await previewSpreadsheet(
    f.repo,
    f.env,
    f.admin,
    "people",
    workbook("people", [
      [
        "u-gabriela",
        1,
        "Gabriela atualizada",
        "gabriela@exemplo.test",
        "AE",
        "EXECUTOR",
        "SIM",
      ],
    ]),
  );
  assert.equal(p.errorCount, 0);
  await applySpreadsheet(f.repo, f.env, f.admin, p.previewId);
  const person = (await f.repo.people()).find((p) => p.id === "u-gabriela");
  assert.equal(person.revision, 2);
  assert.equal(person.department, "AE");
  const protectedRows = await rows(f, "people");
  protectedRows.find((r) => r[0] === "u-gestor")[2] = "Outra pessoa";
  assert.ok(
    (
      await previewSpreadsheet(
        f.repo,
        f.env,
        f.admin,
        "people",
        workbook("people", protectedRows),
      )
    ).errorCount > 0,
  );
  const dup = [
    ["", "", "Teste", "new@example.test", "AE", "EXECUTOR", "SIM"],
    ["", "", "Teste 2", "new@example.test", "AE", "EXECUTOR", "SIM"],
  ];
  assert.ok(
    (
      await previewSpreadsheet(
        f.repo,
        f.env,
        f.admin,
        "people",
        workbook("people", dup),
      )
    ).errorCount > 0,
  );
  f.db.close();
});
test("colunas de fluxo, URL hostil, IDs duplicados e colunas extras não geram confirmação", async () => {
  const f = await setup();
  await draft(f);
  const base = await rows(f);
  for (const [index, value] of [
    [8, "ENCERRADA"],
    [7, "javascript:alert(1)"],
  ]) {
    const r = structuredClone(base);
    r[0][index] = value;
    assert.ok(
      (
        await previewSpreadsheet(
          f.repo,
          f.env,
          f.manager,
          "demands",
          workbook("demands", r),
        )
      ).errorCount > 0,
    );
  }
  assert.ok(
    (
      await previewSpreadsheet(
        f.repo,
        f.env,
        f.manager,
        "demands",
        workbook("demands", [base[0], base[0]]),
      )
    ).errorCount > 0,
  );
  const extra = structuredClone(base);
  extra[0].push("intruso");
  await assert.rejects(
    previewSpreadsheet(
      f.repo,
      f.env,
      f.manager,
      "demands",
      workbook("demands", extra),
    ),
    (e) => e.code === "SHEET_HEADERS",
  );
  f.db.close();
});
test("prévia pertence ao ator, expira e exige papel adequado", async () => {
  const f = await setup();
  const file = workbook("people", [
    ["", "", "Pessoa nova", "nova@example.test", "AE", "EXECUTOR", "SIM"],
  ]);
  await assert.rejects(
    previewSpreadsheet(f.repo, f.env, f.executor, "people", file),
    (e) => e.status === 403,
  );
  const p = await previewSpreadsheet(f.repo, f.env, f.admin, "people", file);
  await assert.rejects(
    applySpreadsheet(f.repo, f.env, f.manager, p.previewId),
    (e) => e.status === 404,
  );
  f.db.raw
    .prepare("UPDATE spreadsheet_imports SET expires_at=0 WHERE id=?")
    .run(p.previewId);
  await assert.rejects(
    applySpreadsheet(f.repo, f.env, f.admin, p.previewId),
    (e) => e.code === "IMPORT_EXPIRED",
  );
  f.db.close();
});
test("Excel rejeita fórmula, macro, XXE, ZIP corrompido e expansão excessiva", async () => {
  const base = await unzipXml(
    workbook("people", [
      ["", "", "Teste", "teste@example.test", "AE", "EXECUTOR", "SIM"],
    ]),
  );
  for (const malicious of [
    {
      ...base,
      "xl/worksheets/sheet1.xml": base["xl/worksheets/sheet1.xml"].replace(
        '<is><t xml:space="preserve">Teste</t></is>',
        '<f>HYPERLINK("https://example.test")</f><v>0</v>',
      ),
    },
    { ...base, "xl/vbaProject.bin": "macro" },
    {
      ...base,
      "xl/workbook.xml":
        '<!DOCTYPE workbook [<!ENTITY x SYSTEM "file:///secret">]>' +
        base["xl/workbook.xml"],
    },
    { ...base, "xl/sharedStrings.xml": "x".repeat(4 * 1024 * 1024 + 1) },
  ])
    await assert.rejects(readWorkbook(zipStored(malicious), "Pessoas"));
  for (const s of ["=1+1", "+SUM(A1)", "@cmd"])
    await assert.rejects(
      readWorkbook(
        workbook("people", [
          ["", "", s, "x@example.test", "AE", "EXECUTOR", "SIM"],
        ]),
        "Pessoas",
      ),
    );
  const corrupt = workbook("people", []);
  corrupt[80] ^= 1;
  await assert.rejects(readWorkbook(corrupt, "Pessoas"));
});
test("log imutável inclui usuário, UTC, correlação e remove credenciais", async () => {
  const f = await setup();
  await recordAudit(f.db, {
    actor: f.manager,
    requestId: "correlation-test",
    action: "TEST",
    resource: "/settings?token=secret",
    details: {
      token: "private-value",
      nested: { password: "private-password" },
      text: "Bearer private-bearer",
    },
  });
  const row = f.db.raw
    .prepare("SELECT * FROM audit_log WHERE action='TEST'")
    .get();
  assert.equal(row.actor_id, f.manager.id);
  assert.match(row.occurred_at, /Z$/);
  assert.equal(row.request_id, "correlation-test");
  assert.ok(!row.details_json.includes("private-"));
  assert.equal(row.resource, "/settings");
  assert.throws(
    () => f.db.raw.prepare("UPDATE audit_log SET action='forged'").run(),
    /AUDIT_APPEND_ONLY/,
  );
  assert.throws(
    () => f.db.raw.prepare("DELETE FROM audit_log").run(),
    /AUDIT_APPEND_ONLY/,
  );
  const response = await exportAudit(f.db, new URLSearchParams("action=TEST")),
    text = await response.text(),
    lines = text.trim().split("\n").map(JSON.parse);
  assert.equal(lines[0].count, 1);
  assert.equal(lines[1].actor_name, f.manager.name);
  const hash = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  ).toString("hex");
  assert.equal(response.headers.get("X-Content-SHA256"), hash);
  f.db.close();
});
test("API nega exportação/log a SDG e demo não grava auditoria", async () => {
  const f = await setup();
  await f.db
    .prepare(
      "INSERT INTO app_settings VALUES('deployment_identity','{\"mode\":\"demo\"}','now')",
    )
    .run();
  const env = {
    ...f.env,
    DEPLOYMENT_MODE: "demo",
    PUBLIC_DEMO: "true",
    SIMULATION_MODE: "true",
    AI_PROVIDER: "mock",
    EMAIL_SEND_ENABLED: "false",
  };
  for (const path of [
    "/api/audit/log",
    "/api/audit/export",
    "/api/spreadsheets/export?kind=people",
  ])
    assert.equal(
      (await fetchHandler(new Request("https://example.test" + path), env))
        .status,
      403,
    );
  assert.equal(f.db.raw.prepare("SELECT count(*) n FROM audit_log").get().n, 0);
  f.db.close();
});
