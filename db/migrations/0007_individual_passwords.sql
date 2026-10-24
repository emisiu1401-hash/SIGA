CREATE TABLE login_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  must_change INTEGER NOT NULL DEFAULT 1 CHECK(must_change IN (0,1)),
  email_snapshot TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE password_links (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  credential_version INTEGER NOT NULL,
  email_snapshot TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_password_links_user ON password_links(user_id,expires_at);
CREATE TABLE password_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  credential_version INTEGER NOT NULL,
  email_snapshot TEXT NOT NULL,
  csrf TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_password_session_user ON password_sessions(user_id,expires_at);
