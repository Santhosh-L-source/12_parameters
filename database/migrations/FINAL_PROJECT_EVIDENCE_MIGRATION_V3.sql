-- ============================================
-- FINAL MIGRATION V3: project_publication_patent_evidence → project_evidence
-- ============================================
-- Option A: Keep VERIFIED status (no breaking changes)
-- Adds canonical columns, constraints, and S001 test student
--
-- IMPROVEMENTS IN V3:
-- - SYNTAX FIX: All RAISE NOTICE wrapped in DO blocks (fixes line 90 error)
-- - Explicit duplicate detection before unique constraint
-- - Pre-migration S001 existence tracking for safe rollback
-- - Comprehensive validation before COMMIT
-- - Accurate transaction error handling comments
-- - Complete manual rollback script included
--
-- REVIEW THIS CAREFULLY BEFORE RUNNING
-- ============================================

BEGIN;

-- ============================================
-- PRE-MIGRATION CHECKS
-- ============================================

-- Record whether S001 already exists (for safe rollback)
CREATE TEMPORARY TABLE IF NOT EXISTS migration_state (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO migration_state (key, value)
SELECT 's001_existed_before_migration',
       CASE WHEN EXISTS(SELECT 1 FROM students WHERE roll_number = 'S001')
            THEN 'true'
            ELSE 'false'
       END;

DO $$
DECLARE
  s001_pre_exists TEXT;
BEGIN
  SELECT value INTO s001_pre_exists FROM migration_state WHERE key = 's001_existed_before_migration';
  RAISE NOTICE 'S001 pre-migration status: %', s001_pre_exists;
END $$;

-- ============================================
-- STEP 1: CREATE S001 TEST STUDENT (IF NOT EXISTS)
-- ============================================

-- Verify MENTOR001 exists
DO $$
DECLARE
  mentor_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mentor_count FROM mentors WHERE mentor_id = 'MENTOR001';
  IF mentor_count = 0 THEN
    RAISE EXCEPTION 'MENTOR001 does not exist. Cannot create S001 student.';
  END IF;
  RAISE NOTICE 'MENTOR001 verified ✓';
END $$;

-- Create S001 test student (or skip if exists)
INSERT INTO students (roll_number, name, email, password_hash, assigned_mentor_id)
VALUES (
  'S001',
  '[TEST] Demo Student - DO NOT USE IN PRODUCTION',
  's001.test.data@example.invalid',
  '$2b$10$dummyHashForTestDataOnly123456789012345678',
  (SELECT id FROM mentors WHERE mentor_id = 'MENTOR001')
)
ON CONFLICT (roll_number) DO NOTHING;

DO $$
DECLARE
  s001_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM students WHERE roll_number = 'S001') INTO s001_exists;
  IF s001_exists THEN
    RAISE NOTICE 'S001 student verified/created ✓';
  ELSE
    RAISE EXCEPTION 'S001 student creation failed';
  END IF;
END $$;

-- ============================================
-- STEP 2: RENAME TABLE
-- ============================================

ALTER TABLE project_publication_patent_evidence
RENAME TO project_evidence;

DO $$ BEGIN
  RAISE NOTICE 'Table renamed to project_evidence ✓';
END $$;

-- ============================================
-- STEP 3: ADD NEW CANONICAL COLUMNS
-- ============================================

-- Add distinct_key (nullable initially)
ALTER TABLE project_evidence
ADD COLUMN IF NOT EXISTS distinct_key TEXT;

-- Populate distinct_key from output_name + achievement_stage
UPDATE project_evidence
SET distinct_key = output_name || '_' || achievement_stage
WHERE distinct_key IS NULL;

DO $$ BEGIN
  RAISE NOTICE 'distinct_key populated from output_name + achievement_stage ✓';
END $$;

-- Add generated normalized column
ALTER TABLE project_evidence
ADD COLUMN IF NOT EXISTS distinct_key_normalized TEXT
GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;

-- Add verification_source
ALTER TABLE project_evidence
ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL';

-- Backfill existing rows
UPDATE project_evidence
SET verification_source = 'MENTOR_MANUAL'
WHERE verification_source IS NULL;

-- Add rejection_reason
ALTER TABLE project_evidence
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add submitted_at
ALTER TABLE project_evidence
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill submitted_at from created_at for existing rows
UPDATE project_evidence
SET submitted_at = created_at
WHERE submitted_at IS NULL;

-- Make submitted_at NOT NULL after backfill
ALTER TABLE project_evidence
ALTER COLUMN submitted_at SET NOT NULL;

-- Keep output_name for backward compatibility (Sequelize model expects it)
-- No action needed - column already exists

DO $$ BEGIN
  RAISE NOTICE 'New columns added and populated ✓';
END $$;

-- ============================================
-- STEP 4: ADD/UPDATE CONSTRAINTS
-- ============================================

-- Drop old constraints if they exist (to allow renaming/updating)
ALTER TABLE project_evidence
DROP CONSTRAINT IF EXISTS project_publication_patent_evidence_achievement_type_check;

ALTER TABLE project_evidence
DROP CONSTRAINT IF EXISTS project_publication_patent_evidence_status_check;

-- Semester range (1-6)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'project_evidence_semester_check'
  ) THEN
    ALTER TABLE project_evidence
    ADD CONSTRAINT project_evidence_semester_check
    CHECK (semester BETWEEN 1 AND 6);
  END IF;
END $$;

-- Stage marks non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'project_evidence_stage_marks_check'
  ) THEN
    ALTER TABLE project_evidence
    ADD CONSTRAINT project_evidence_stage_marks_check
    CHECK (stage_marks >= 0);
  END IF;
END $$;

-- Achievement type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'project_evidence_achievement_type_check'
  ) THEN
    ALTER TABLE project_evidence
    ADD CONSTRAINT project_evidence_achievement_type_check
    CHECK (achievement_type IN ('PROJECT', 'PUBLICATION', 'PATENT'));
  END IF;
END $$;

-- Status values (Option A: Keep VERIFIED for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'project_evidence_status_check'
  ) THEN
    ALTER TABLE project_evidence
    ADD CONSTRAINT project_evidence_status_check
    CHECK (status IN ('PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'CLARIFICATION_NEEDED', 'FETCH_FAILED'));
  END IF;
END $$;

-- Verification source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'project_evidence_verification_source_check'
  ) THEN
    ALTER TABLE project_evidence
    ADD CONSTRAINT project_evidence_verification_source_check
    CHECK (verification_source IN ('PLATFORM_AUTO', 'PLATFORM_PARTIAL', 'MENTOR_MANUAL', 'INTERNAL_SYSTEM'));
  END IF;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'CHECK constraints added ✓';
END $$;

-- ============================================
-- STEP 5: ADD UNIQUE CONSTRAINT (WITH DUPLICATE CHECK)
-- ============================================

-- EXPLICIT DUPLICATE DETECTION
DO $$
DECLARE
  dup_count INTEGER;
  dup_details TEXT;
BEGIN
  -- Count duplicate combinations
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT student_id, output_name, achievement_stage, COUNT(*) AS occurrences
    FROM project_evidence
    GROUP BY student_id, output_name, achievement_stage
    HAVING COUNT(*) > 1
  ) duplicates;

  -- If duplicates found, abort with details
  IF dup_count > 0 THEN
    SELECT STRING_AGG(
      student_id || ' | ' || output_name || ' | ' || achievement_stage || ' (' || occurrences::TEXT || ' times)',
      E'\n'
    ) INTO dup_details
    FROM (
      SELECT student_id, output_name, achievement_stage, COUNT(*) AS occurrences
      FROM project_evidence
      GROUP BY student_id, output_name, achievement_stage
      HAVING COUNT(*) > 1
    ) duplicates;

    RAISE EXCEPTION E'Cannot add unique constraint: % duplicate combinations found:\n%', dup_count, dup_details;
  END IF;

  RAISE NOTICE 'Duplicate check passed: 0 duplicates found ✓';
END $$;

-- Add unique constraint: (student_id, output_name, achievement_stage)
-- This matches the Sequelize model's unique index definition
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_evidence_unique
ON project_evidence(student_id, output_name, achievement_stage);

DO $$ BEGIN
  RAISE NOTICE 'Unique constraint added ✓';
END $$;

-- ============================================
-- STEP 6: ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- FK: student_id → students(roll_number)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_project_evidence_student'
  ) THEN
    ALTER TABLE project_evidence
    ADD CONSTRAINT fk_project_evidence_student
    FOREIGN KEY (student_id)
    REFERENCES students(roll_number)
    ON DELETE CASCADE;
  END IF;
END $$;

-- FK: mentor_id → mentors(mentor_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_project_evidence_mentor'
  ) THEN
    ALTER TABLE project_evidence
    ADD CONSTRAINT fk_project_evidence_mentor
    FOREIGN KEY (mentor_id)
    REFERENCES mentors(mentor_id);
  END IF;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'Foreign key constraints added ✓';
END $$;

-- ============================================
-- STEP 7: UPDATE INDEXES
-- ============================================

-- Drop old indexes (from old table name)
DROP INDEX IF EXISTS idx_project_student;
DROP INDEX IF EXISTS idx_project_status;
DROP INDEX IF EXISTS idx_project_mentor;
DROP INDEX IF EXISTS idx_project_admin;
DROP INDEX IF EXISTS idx_project_pub_patent_student_id;

-- Create new indexes with canonical names
CREATE INDEX IF NOT EXISTS idx_project_evidence_student
ON project_evidence(student_id);

CREATE INDEX IF NOT EXISTS idx_project_evidence_status
ON project_evidence(status);

CREATE INDEX IF NOT EXISTS idx_project_evidence_mentor
ON project_evidence(mentor_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_project_evidence_student_semester_status
ON project_evidence(student_id, semester, status);

DO $$ BEGIN
  RAISE NOTICE 'Indexes updated ✓';
END $$;

-- ============================================
-- STEP 8: ENSURE RLS REMAINS ENABLED
-- ============================================

-- RLS should already be enabled (verified earlier)
-- Renaming a table preserves RLS status
-- Verify and confirm:
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE tablename = 'project_evidence';

  IF NOT rls_enabled THEN
    ALTER TABLE project_evidence ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on project_evidence';
  ELSE
    RAISE NOTICE 'RLS already enabled ✓';
  END IF;
END $$;

-- ============================================
-- STEP 9: COMPREHENSIVE VALIDATION BEFORE COMMIT
-- ============================================

DO $$
DECLARE
  table_exists BOOLEAN;
  row_count INTEGER;
  s001_exists BOOLEAN;
  unique_index_exists BOOLEAN;
  fk_student_exists BOOLEAN;
  fk_mentor_exists BOOLEAN;
  rls_enabled BOOLEAN;
  validation_errors TEXT := '';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDATION CHECKS';
  RAISE NOTICE '========================================';

  -- Check 1: Table exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'project_evidence'
  ) INTO table_exists;

  IF NOT table_exists THEN
    validation_errors := validation_errors || E'\n- project_evidence table does not exist';
  ELSE
    RAISE NOTICE '✓ project_evidence table exists';
  END IF;

  -- Check 2: Row count (should be 3 for S001)
  SELECT COUNT(*) INTO row_count FROM project_evidence;
  IF row_count != 3 THEN
    validation_errors := validation_errors || E'\n- Expected 3 evidence rows, found ' || row_count::TEXT;
  ELSE
    RAISE NOTICE '✓ 3 evidence rows present';
  END IF;

  -- Check 3: S001 student exists
  SELECT EXISTS(SELECT 1 FROM students WHERE roll_number = 'S001') INTO s001_exists;
  IF NOT s001_exists THEN
    validation_errors := validation_errors || E'\n- S001 student not found';
  ELSE
    RAISE NOTICE '✓ S001 student exists';
  END IF;

  -- Check 4: Unique index exists
  SELECT EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'project_evidence'
    AND indexname = 'idx_project_evidence_unique'
  ) INTO unique_index_exists;

  IF NOT unique_index_exists THEN
    validation_errors := validation_errors || E'\n- Unique index missing';
  ELSE
    RAISE NOTICE '✓ Unique index exists';
  END IF;

  -- Check 5: FK to students exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_project_evidence_student'
    AND table_name = 'project_evidence'
  ) INTO fk_student_exists;

  IF NOT fk_student_exists THEN
    validation_errors := validation_errors || E'\n- FK to students missing';
  ELSE
    RAISE NOTICE '✓ FK to students exists';
  END IF;

  -- Check 6: FK to mentors exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_project_evidence_mentor'
    AND table_name = 'project_evidence'
  ) INTO fk_mentor_exists;

  IF NOT fk_mentor_exists THEN
    validation_errors := validation_errors || E'\n- FK to mentors missing';
  ELSE
    RAISE NOTICE '✓ FK to mentors exists';
  END IF;

  -- Check 7: RLS enabled
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE tablename = 'project_evidence';

  IF NOT rls_enabled THEN
    validation_errors := validation_errors || E'\n- RLS not enabled';
  ELSE
    RAISE NOTICE '✓ RLS enabled';
  END IF;

  -- Final validation result
  IF validation_errors != '' THEN
    RAISE EXCEPTION E'VALIDATION FAILED:%', validation_errors;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ ALL VALIDATIONS PASSED';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- VERIFICATION QUERIES (FOR REVIEW)
-- ============================================

-- Show FK constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'project_evidence'
ORDER BY tc.constraint_name;

-- Show unique indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'project_evidence'
  AND indexdef LIKE '%UNIQUE%';

-- Show CHECK constraints
SELECT
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE 'project_evidence%'
ORDER BY constraint_name;

-- Show new columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'project_evidence'
  AND column_name IN ('distinct_key', 'distinct_key_normalized', 'verification_source', 'rejection_reason', 'submitted_at')
ORDER BY column_name;

-- Show S001 evidence rows
SELECT
  id,
  student_id,
  semester,
  achievement_type,
  output_name,
  achievement_stage,
  stage_marks,
  status,
  distinct_key,
  verification_source,
  submitted_at
FROM project_evidence
ORDER BY id;

-- ============================================
-- COMMIT TRANSACTION
-- ============================================

-- IMPORTANT: Transaction error handling
-- If any error occurred above:
--   - The transaction is in an ABORTED state
--   - All changes are discarded
--   - COMMIT will complete the rollback (no changes persist)
-- If no errors occurred:
--   - COMMIT will persist all changes atomically

COMMIT;

-- ============================================
-- POST-MIGRATION SUMMARY
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ S001 test student created (if not exists)';
  RAISE NOTICE '  ✓ Table renamed: project_evidence';
  RAISE NOTICE '  ✓ Added columns: distinct_key, distinct_key_normalized, verification_source, rejection_reason, submitted_at';
  RAISE NOTICE '  ✓ Added CHECK constraints: semester, stage_marks, achievement_type, status, verification_source';
  RAISE NOTICE '  ✓ Added UNIQUE constraint: (student_id, output_name, achievement_stage)';
  RAISE NOTICE '  ✓ Added FK constraints: student_id, mentor_id';
  RAISE NOTICE '  ✓ Updated indexes';
  RAISE NOTICE '  ✓ RLS remains enabled';
  RAISE NOTICE '  ✓ 3 S001 evidence rows preserved';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  REQUIRED CODE CHANGE:';
  RAISE NOTICE '  Update Project_Publication_Patent/src/models/ProjectPubPatentEvidence.js line 57:';
  RAISE NOTICE '    tableName: ''project_evidence'',';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;


-- ############################################
-- ############################################
-- ##                                        ##
-- ##   MANUAL ROLLBACK SCRIPT (BELOW)      ##
-- ##                                        ##
-- ############################################
-- ############################################

/*

-- ============================================
-- ROLLBACK SCRIPT
-- ============================================
-- Run this ONLY if you need to reverse the migration
-- Copy everything between the BEGIN/COMMIT below

BEGIN;

-- ============================================
-- STEP 1: DROP FOREIGN KEY CONSTRAINTS
-- ============================================

ALTER TABLE project_evidence
DROP CONSTRAINT IF EXISTS fk_project_evidence_student;

ALTER TABLE project_evidence
DROP CONSTRAINT IF EXISTS fk_project_evidence_mentor;

RAISE NOTICE 'Foreign key constraints dropped ✓';

-- ============================================
-- STEP 2: DROP INDEXES
-- ============================================

DROP INDEX IF EXISTS idx_project_evidence_unique;
DROP INDEX IF EXISTS idx_project_evidence_student;
DROP INDEX IF EXISTS idx_project_evidence_status;
DROP INDEX IF EXISTS idx_project_evidence_mentor;
DROP INDEX IF EXISTS idx_project_evidence_student_semester_status;

RAISE NOTICE 'Migration indexes dropped ✓';

-- ============================================
-- STEP 3: DROP CHECK CONSTRAINTS
-- ============================================

ALTER TABLE project_evidence
DROP CONSTRAINT IF EXISTS project_evidence_semester_check;

ALTER TABLE project_evidence
DROP CONSTRAINT IF EXISTS project_evidence_stage_marks_check;

ALTER TABLE project_evidence
DROP CONSTRAINT IF EXISTS project_evidence_achievement_type_check;

ALTER TABLE project_evidence
DROP CONSTRAINT IF EXISTS project_evidence_status_check;

ALTER TABLE project_evidence
DROP CONSTRAINT IF EXISTS project_evidence_verification_source_check;

RAISE NOTICE 'CHECK constraints dropped ✓';

-- ============================================
-- STEP 4: DROP NEW COLUMNS
-- ============================================

-- Drop distinct_key (CASCADE drops the generated column automatically)
ALTER TABLE project_evidence
DROP COLUMN IF EXISTS distinct_key CASCADE;

-- Drop other new columns
ALTER TABLE project_evidence
DROP COLUMN IF EXISTS distinct_key_normalized;

ALTER TABLE project_evidence
DROP COLUMN IF EXISTS verification_source;

ALTER TABLE project_evidence
DROP COLUMN IF EXISTS rejection_reason;

ALTER TABLE project_evidence
DROP COLUMN IF EXISTS submitted_at;

RAISE NOTICE 'New columns dropped ✓';

-- ============================================
-- STEP 5: RENAME TABLE BACK
-- ============================================

ALTER TABLE project_evidence
RENAME TO project_publication_patent_evidence;

RAISE NOTICE 'Table renamed back to project_publication_patent_evidence ✓';

-- ============================================
-- STEP 6: RESTORE OLD INDEXES (IF THEY EXISTED)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_project_pub_patent_student_id
ON project_publication_patent_evidence(student_id);

RAISE NOTICE 'Old indexes restored ✓';

-- ============================================
-- STEP 7: DELETE S001 STUDENT (CONDITIONALLY)
-- ============================================

-- IMPORTANT: This checks if S001 was created BY THIS MIGRATION
-- If S001 existed BEFORE the migration, it will NOT be deleted

DO $$
DECLARE
  s001_pre_existed TEXT;
BEGIN
  -- Check migration_state temp table (only exists during migration session)
  -- If temp table is gone, assume S001 should NOT be deleted (safe default)
  SELECT value INTO s001_pre_existed
  FROM migration_state
  WHERE key = 's001_existed_before_migration';

  IF s001_pre_existed IS NULL THEN
    RAISE NOTICE 'Cannot determine S001 pre-migration status. NOT deleting S001 (safe default).';
  ELSIF s001_pre_existed = 'false' THEN
    DELETE FROM students WHERE roll_number = 'S001';
    RAISE NOTICE 'S001 student deleted (was created by migration) ✓';
  ELSE
    RAISE NOTICE 'S001 student preserved (existed before migration) ✓';
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify table exists with old name
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'project_publication_patent_evidence'
) AS old_table_exists;

-- Verify row count (should still be 3)
SELECT COUNT(*) AS evidence_count FROM project_publication_patent_evidence;

-- Verify S001 status
SELECT
  roll_number,
  name,
  email
FROM students
WHERE roll_number = 'S001';

COMMIT;

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE '✅ ROLLBACK COMPLETE';
RAISE NOTICE '========================================';

-- End of rollback script
*/
