-- ============================================================
-- Production Hardening Migration
-- Kripanidhi Legal — tracking-files
-- ============================================================

-- ── 1. Performance Indexes ────────────────────────────────────────

-- loan_files: most common filter combinations
CREATE INDEX IF NOT EXISTS idx_loan_files_status_deleted
  ON loan_files (current_status, deleted_at);

CREATE INDEX IF NOT EXISTS idx_loan_files_customer_id
  ON loan_files (customer_id);

CREATE INDEX IF NOT EXISTS idx_loan_files_deleted_at
  ON loan_files (deleted_at);

-- audit_logs: resource lookup and actor lookup
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs (resource_id, resource_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC);

-- refresh_tokens: token hash lookup (login / refresh / revoke)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
  ON refresh_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked
  ON refresh_tokens (user_id, revoked_at);

-- comments: file lookup excluding deleted
CREATE INDEX IF NOT EXISTS idx_comments_file_deleted
  ON comments (file_id, deleted_at);

-- status_history: file lookup
CREATE INDEX IF NOT EXISTS idx_status_history_file
  ON status_history (file_id);

-- users: active users by email
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users (role, is_active);


-- ── 2. Append-Only Audit Log Enforcement ──────────────────────────
-- Prevent UPDATE and DELETE on audit_logs via a trigger.
-- This makes the audit log immutable at the database level.

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable and cannot be modified or deleted.';
END;
$$;

-- Drop existing triggers if they exist (idempotent)
DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;

CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();


-- ── 3. Foreign Key Verification ────────────────────────────────────
-- These are declarative checks — add only if your schema is missing them.
-- Run EXPLAIN on your current schema to verify FKs already exist first.
-- Uncomment if missing:

-- ALTER TABLE loan_files
--   ADD CONSTRAINT IF NOT EXISTS fk_loan_files_customer
--   FOREIGN KEY (customer_id) REFERENCES users(id);

-- ALTER TABLE comments
--   ADD CONSTRAINT IF NOT EXISTS fk_comments_author
--   FOREIGN KEY (author_id) REFERENCES users(id);

-- ALTER TABLE refresh_tokens
--   ADD CONSTRAINT IF NOT EXISTS fk_refresh_tokens_user
--   FOREIGN KEY (user_id) REFERENCES users(id);


-- ── 4. Audit Log RLS (Row Level Security) ─────────────────────────
-- Only the service role (backend) can INSERT audit logs.
-- Admins (authenticated with role='admin') can SELECT.
-- Nobody can UPDATE or DELETE (enforced by trigger above).

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow backend (service_role) to insert
DROP POLICY IF EXISTS audit_logs_insert_service ON audit_logs;
CREATE POLICY audit_logs_insert_service
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow admins to read audit logs
-- (This assumes your app uses the service_role key for all backend calls;
--  adjust if you use anon key + JWT auth with Supabase Auth.)
DROP POLICY IF EXISTS audit_logs_select_service ON audit_logs;
CREATE POLICY audit_logs_select_service
  ON audit_logs FOR SELECT
  TO service_role
  USING (true);
