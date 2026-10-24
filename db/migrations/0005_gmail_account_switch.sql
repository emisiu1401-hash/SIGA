-- Gmail OAuth account selection is independent from application login identities.
CREATE TABLE gmail_connections (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL REFERENCES mailbox_accounts(id),
  refresh_token_cipher TEXT NOT NULL,
  scopes TEXT NOT NULL,
  connected_by TEXT NOT NULL REFERENCES users(id),
  connected_at TEXT NOT NULL
);
CREATE TABLE gmail_control (
  id INTEGER PRIMARY KEY CHECK(id=1),
  active_connection_id TEXT REFERENCES gmail_connections(id),
  version INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 1 CHECK(paused IN (0,1)),
  lease_owner TEXT,
  busy_until INTEGER NOT NULL DEFAULT 0
);
INSERT INTO gmail_control(id) VALUES(1);
CREATE TABLE gmail_oauth_requests (
  state_hash TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  expected_email TEXT NOT NULL,
  verifier_cipher TEXT NOT NULL,
  control_version INTEGER NOT NULL,
  request_send INTEGER NOT NULL CHECK(request_send IN (0,1)),
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','PROCESSING','COMPLETE','FAILED'))
);
CREATE INDEX idx_gmail_oauth_expiry ON gmail_oauth_requests(expires_at);

-- Provider IDs are scoped to a mailbox, never global across Google accounts.
ALTER TABLE ingestion_reviews RENAME TO ingestion_reviews_legacy;
CREATE TABLE ingestion_reviews (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL DEFAULT 'primary',
  provider_message_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  fresh_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(mailbox_id,provider_message_id)
);
INSERT INTO ingestion_reviews(id,provider_message_id,sender,subject,fresh_text,reason,created_at)
SELECT id,provider_message_id,sender,subject,fresh_text,reason,created_at FROM ingestion_reviews_legacy;
DROP TABLE ingestion_reviews_legacy;
