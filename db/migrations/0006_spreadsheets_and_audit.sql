ALTER TABLE users ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  roles_json TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  source TEXT NOT NULL,
  outcome TEXT NOT NULL,
  http_status INTEGER,
  duration_ms INTEGER,
  details_json TEXT NOT NULL
);
CREATE INDEX idx_audit_time ON audit_log(occurred_at DESC,id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id,occurred_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action,occurred_at DESC);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END;
CREATE TABLE spreadsheet_imports (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('demands','people')),
  status TEXT NOT NULL CHECK(status IN ('PREVIEW','APPLYING','APPLIED','FAILED')),
  state_json TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  applied_at TEXT,
  result_json TEXT
);
CREATE INDEX idx_spreadsheet_expiry ON spreadsheet_imports(expires_at);
