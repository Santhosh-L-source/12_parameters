-- Run in Supabase SQL Editor to fix integer overflow for 12-digit register numbers
ALTER TABLE gate_evidence
  ALTER COLUMN student_id TYPE BIGINT,
  ALTER COLUMN mentor_id  TYPE BIGINT;

ALTER TABLE gate_branch_calibration
  ALTER COLUMN updated_by TYPE BIGINT;
