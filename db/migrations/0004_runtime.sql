-- Application aggregates and transactional concurrency guards; preserves 0001..0003.
CREATE TABLE siga_aggregates (id TEXT PRIMARY KEY REFERENCES demands(id), version INTEGER NOT NULL, state_json TEXT NOT NULL);
CREATE TRIGGER siga_version_guard BEFORE UPDATE ON siga_aggregates
WHEN NEW.version != OLD.version + 1 BEGIN SELECT RAISE(ABORT, 'STALE_VERSION'); END;
CREATE TABLE siga_commands (id TEXT PRIMARY KEY, demand_id TEXT, result_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE security_events (id TEXT PRIMARY KEY, actor_id TEXT, type TEXT NOT NULL, details TEXT NOT NULL, occurred_at TEXT NOT NULL);
CREATE TABLE auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE gmail_sync_state (id TEXT PRIMARY KEY, history_id TEXT, last_sync_at TEXT, last_error TEXT, lease_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE ingestion_reviews (id TEXT PRIMARY KEY, provider_message_id TEXT NOT NULL UNIQUE, sender TEXT NOT NULL, subject TEXT NOT NULL, fresh_text TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE runtime_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE INDEX idx_demands_opened ON demands(opened_at, id);
CREATE INDEX idx_outbox_status ON outbound_messages(status,created_at);
