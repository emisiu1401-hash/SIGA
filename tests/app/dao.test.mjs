import test from "node:test";
import assert from "node:assert/strict";
import { LocalD1 } from "../../scripts/sqlite.mjs";
import {
  Repository,
  seedDirectory,
  createAggregate,
  transition,
  dashboard,
} from "../../dist/testing.js";

test("DAO: cadastro, autoatribuição, aceite e métricas preservam histórico e perfis", async () => {
  const db = new LocalD1();
  db.migrate();
  const repo = new Repository(db);
  await seedDirectory(repo);
  const at = "2026-10-24T12:00:00Z";
  const original = (await repo.people()).find((p) => p.id === "u-gestor");
  // Fixture sintética da atualização administrativa de lotação, sem alterar papéis.
  db.raw
    .prepare("UPDATE users SET department_id='dept-dao' WHERE id='u-gestor'")
    .run();
  const people = await repo.people();
  const manager = people.find((p) => p.id === "u-gestor");
  assert.deepEqual(manager.roles, original.roles);
  await repo.personSave(
    {
      id: "dao-executor",
      name: "Executor DAO de teste",
      email: "dao@example.test",
      department: "DAO",
      roles: ["EXECUTOR"],
      active: true,
    },
    "u-admin",
    at,
  );
  assert.equal(
    (await repo.people()).find((p) => p.id === "dao-executor").department,
    "DAO",
  );
  let state = createAggregate(
    "dao-demand",
    "SIGA-2026-9001",
    "Demanda própria DAO",
    "Teste sintético",
    manager.id,
    at,
  );
  const apply = async (type, extra = {}) => {
    const before = state.version ? structuredClone(state) : null;
    const id = crypto.randomUUID();
    state = transition(
      state,
      { id, type, expectedVersion: state.version, ...extra },
      manager,
      people,
      at,
    ).state;
    await repo.save(state, before, id);
  };
  await apply("CREATE");
  await apply("ASSIGN", {
    personId: manager.id,
    priority: "ALTA",
    date: "2026-10-27",
    reason: "Execução direta pelo gestor",
  });
  const env = {
    SIMULATION_MODE: "true",
    SEI_ALLOWED_HOSTS: "sei.tjmsp.jus.br",
  };
  const query = (p) =>
    dashboard(repo, new URLSearchParams(p), manager, at, env);
  assert.equal(
    (await query("department=DAO")).total,
    0,
    "proposta ainda não efetiva a área",
  );
  await apply("ACCEPT", { date: "2026-10-27" });
  const result = await query("department=DAO&person=u-gestor");
  assert.equal(result.total, 1);
  assert.equal(result.kpis.active, 1);
  assert.equal(result.sections.find((s) => s.name === "DAO").high, 1);
  assert.equal(
    result.sections.reduce((n, s) => n + s.total, 0),
    result.kpis.active,
  );
  assert.equal(
    result.people.find((p) => p.id === manager.id).department,
    "DAO",
  );
  assert.equal(result.rows[0].department, "DAO");
  db.raw
    .prepare("UPDATE users SET department_id='dept-ae' WHERE id='u-gestor'")
    .run();
  assert.equal(
    (await query("department=DAO")).total,
    1,
    "lotação posterior não reclassifica demanda aceita",
  );
  assert.equal((await repo.get(state.id)).assignments[0].department, "DAO");
  db.close();
});
