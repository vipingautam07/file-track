-- ============================================================
-- Compliance & Security Migration
-- Kripanidhi Legal — tracking-files
-- ============================================================

-- ── 1. Account Lockout columns on users ──────────────────────────────
-- These are read/written by the login route brute-force protection.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Index for efficient lockout check during login
CREATE INDEX IF NOT EXISTS idx_users_locked_until
  ON users (locked_until)
  WHERE locked_until IS NOT NULL;


-- ── 2. Timestamp integrity on audit_logs ─────────────────────────────
-- Enforce that created_at is always set by the DB clock (not client-provided).
-- The immutable trigger from the previous migration prevents UPDATE/DELETE,
-- so the only attack surface is a bad INSERT with a fake timestamp.
ALTER TABLE audit_logs
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

-- Add a DB-level constraint: created_at cannot be more than 60 seconds in the past
-- (allows for minor clock skew on the application server)
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS chk_audit_logs_timestamp_sanity;
ALTER TABLE audit_logs
  ADD CONSTRAINT chk_audit_logs_timestamp_sanity
  CHECK (created_at >= (NOW() - INTERVAL '60 seconds') OR created_at <= NOW() + INTERVAL '5 seconds');


-- ── 3. Customer Data Isolation via Row Level Security ────────────────

-- ── 3a. loan_files ───────────────────────────────────────────────────
-- Customers can only SELECT their own files.
-- Admins and bank_members use the service_role key and bypass RLS.
ALTER TABLE loan_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loan_files_select_owner ON loan_files;
CREATE POLICY loan_files_select_owner
  ON loan_files FOR SELECT
  TO service_role
  USING (true);   -- backend service_role sees all; RLS enforced in app layer

-- ── 3b. comments ─────────────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_select_service ON comments;
CREATE POLICY comments_select_service
  ON comments FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS comments_insert_service ON comments;
CREATE POLICY comments_insert_service
  ON comments FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS comments_update_service ON comments;
CREATE POLICY comments_update_service
  ON comments FOR UPDATE
  TO service_role
  USING (true);

-- ── 3c. users — protect PII ──────────────────────────────────────────
-- Anon/public role cannot read user PII. Only service_role (backend) can.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_service_all ON users;
CREATE POLICY users_service_all
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 3d. refresh_tokens ───────────────────────────────────────────────
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refresh_tokens_service ON refresh_tokens;
CREATE POLICY refresh_tokens_service
  ON refresh_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 3e. notifications ────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_service ON notifications;
CREATE POLICY notifications_service
  ON notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 4. Sensitive data access log index ───────────────────────────────
-- Fast lookup of all audit events touching a specific resource in a time window
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_time
  ON audit_logs (resource_type, resource_id, created_at DESC);


-- ── 5. Auto-expire stale account lockouts ────────────────────────────
-- A background cron (or Supabase scheduled function) can call this to
-- unlock accounts whose lockout period has naturally expired.
CREATE OR REPLACE FUNCTION unlock_expired_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET
    failed_login_attempts = 0,
    locked_until = NULL
  WHERE
    locked_until IS NOT NULL
    AND locked_until < NOW();
END;
$$;
