-- Migration: Fix hundred_days_evidence to use profiles.id_number FK
-- Changes:
-- 1. student_id: students(roll_number) → profiles(id_number)
-- 2. mentor_id: INTEGER mentors(id) → TEXT profiles(id_number)

BEGIN;

-- Drop existing FK constraints
ALTER TABLE hundred_days_evidence
  DROP CONSTRAINT IF EXISTS hundred_days_evidence_student_id_fkey;

ALTER TABLE hundred_days_evidence
  DROP CONSTRAINT IF EXISTS hundred_days_evidence_mentor_id_fkey;

-- Change mentor_id from INTEGER to TEXT
ALTER TABLE hundred_days_evidence
  ALTER COLUMN mentor_id TYPE TEXT USING
    CASE
      WHEN mentor_id IS NOT NULL THEN 'MENTOR_' || mentor_id::TEXT
      ELSE NULL
    END;

-- Add new FK constraints pointing to profiles
ALTER TABLE hundred_days_evidence
  ADD CONSTRAINT hundred_days_evidence_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES profiles(id_number) ON DELETE RESTRICT;

ALTER TABLE hundred_days_evidence
  ADD CONSTRAINT hundred_days_evidence_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES profiles(id_number) ON DELETE SET NULL;

COMMIT;

-- Verify changes
DO $$
DECLARE
  student_fk_count INTEGER;
  mentor_fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO student_fk_count
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'hundred_days_evidence'
    AND con.conname = 'hundred_days_evidence_student_id_fkey';

  SELECT COUNT(*) INTO mentor_fk_count
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'hundred_days_evidence'
    AND con.conname = 'hundred_days_evidence_mentor_id_fkey';

  IF student_fk_count = 1 AND mentor_fk_count = 1 THEN
    RAISE NOTICE '✅ FK constraints updated successfully';
  ELSE
    RAISE EXCEPTION '❌ FK constraints not created properly';
  END IF;
END $$;

COMMENT ON COLUMN hundred_days_evidence.student_id IS 'FK to profiles.id_number (student roll_number)';
COMMENT ON COLUMN hundred_days_evidence.mentor_id IS 'FK to profiles.id_number (MENTOR_N format)';
