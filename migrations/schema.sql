-- IAYA community schema, version 1. Apply before enabling membership.
-- D1 migrations are deployment work; request handlers never create tables.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community_schema (
  version INTEGER PRIMARY KEY CHECK (version = 1)
);
INSERT OR IGNORE INTO community_schema (version) VALUES (1);

CREATE TABLE IF NOT EXISTS community_users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  email_authoritative INTEGER NOT NULL DEFAULT 0 CHECK (email_authoritative IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS auth_nonces_expiry ON auth_nonces (expires_at);

-- Short-lived hashed network buckets; no raw addresses or permanent activity log.
CREATE TABLE IF NOT EXISTS community_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_rate_limits_expiry ON community_rate_limits (expires_at);

CREATE TABLE IF NOT EXISTS community_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES community_users (id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_sessions_expiry ON community_sessions (expires_at);

CREATE TABLE IF NOT EXISTS membership_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES community_users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  university TEXT NOT NULL CHECK (length(university) <= 180),
  field TEXT NOT NULL CHECK (length(field) <= 180),
  message TEXT NOT NULL CHECK (length(message) <= 2000),
  consent_at INTEGER NOT NULL,
  privacy_version TEXT NOT NULL DEFAULT '2026-10-12',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT REFERENCES community_users (id),
  reviewed_at INTEGER,
  review_token TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS membership_review_queue ON membership_applications (status, created_at);

CREATE TABLE IF NOT EXISTS membership_audit (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES membership_applications (id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES community_users (id),
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS membership_audit_application ON membership_audit (application_id, created_at);
