-- SIGA v2.2 — D1/SQLite. Migration ADITIVA, sem mudanças destrutivas.
-- Separar lotação ATUAL da pessoa, seção responsável ATUAL pela demanda e
-- snapshot histórico da seção na atribuição (para séries históricas corretas).
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES departments(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO departments(id,code,name,parent_id,active,created_at) VALUES
 ('dept-slc','SLC','Seção de Licitações, Compras e Contratos',NULL,1,'2026-10-23T00:00:00Z'),
 ('dept-sap','SAP','Seção de Almoxarifado e Patrimônio',NULL,1,'2026-10-23T00:00:00Z'),
 ('dept-sme','SME','Seção de Administração Predial e Manutenção',NULL,1,'2026-10-23T00:00:00Z'),
 ('dept-ae','AE','Assistência de Engenharia',NULL,1,'2026-10-23T00:00:00Z');

-- FK opcional: remetente institucional externo à DAO pode abrir triagem sem lotação.
ALTER TABLE users ADD COLUMN department_id TEXT REFERENCES departments(id);
ALTER TABLE demands ADD COLUMN origin_department_id TEXT REFERENCES departments(id);
ALTER TABLE demands ADD COLUMN current_department_id TEXT REFERENCES departments(id);
ALTER TABLE assignments ADD COLUMN department_snapshot_id TEXT REFERENCES departments(id);

CREATE TABLE IF NOT EXISTS user_department_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  registered_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  CHECK(valid_until IS NULL OR valid_until >= valid_from)
);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id,active);
CREATE INDEX IF NOT EXISTS idx_demands_current_department ON demands(current_department_id,status,priority);
CREATE INDEX IF NOT EXISTS idx_demands_origin_department ON demands(origin_department_id);
CREATE INDEX IF NOT EXISTS idx_assignments_department_snapshot ON assignments(department_snapshot_id,status,current_due_date);
CREATE INDEX IF NOT EXISTS idx_department_history_person ON user_department_history(user_id,valid_from);

-- Migrations NÃO inferem departamento de nomes/email e não recalculam históricos.
-- O serviço de atribuição cria snapshot da lotação do executor E event log imutável.
-- A unidade corrente da demanda muda SOMENTE ao efetivar a atribuição principal.
-- Em triagem sem executor, current_department_id permanece NULL (Não classificada).
