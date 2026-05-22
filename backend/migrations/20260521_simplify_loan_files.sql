-- ============================================================
-- Simplify loan_files: remove NOT NULL from personal data columns
-- Files now only require a file_number — all PII is optional
-- ============================================================

ALTER TABLE loan_files
  ALTER COLUMN customer_id     DROP NOT NULL,
  ALTER COLUMN applicant_name  DROP NOT NULL,
  ALTER COLUMN applicant_email DROP NOT NULL,
  ALTER COLUMN created_by      DROP NOT NULL;
