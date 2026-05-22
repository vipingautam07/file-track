-- ============================================================
-- Fix: notifications recipient_id nullable + bank_recipient_emails
-- ============================================================

-- Allow bank email notifications (no system user account)
ALTER TABLE notifications ALTER COLUMN recipient_id DROP NOT NULL;

-- Store bank emails on the file itself so we can notify on every update
ALTER TABLE loan_files ADD COLUMN IF NOT EXISTS bank_recipient_emails text[] DEFAULT '{}';
