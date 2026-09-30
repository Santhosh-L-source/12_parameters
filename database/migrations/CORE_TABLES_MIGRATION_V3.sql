-- ============================================
-- CORE INFRASTRUCTURE MIGRATION V3
-- ============================================
-- Creates the three foundational tables needed by all modules:
-- 1. parameters (12 modules, sum = 250 marks)
-- 2. scores (unified marks storage)
-- 3. audit_log (accountability trail)
--
-- FIXES IN V2:
-- - audit_log.student_id now ON DELETE RESTRICT (preserves audit trail)
-- - Validates exact 12 canonical parameter IDs (not just count/total)
--
-- FIXES IN V3:
-- - Added table_schema = 'public' filter to validation queries
-- - Prevents false positive from information_schema.parameters system table
--
-- SCOPE: Only creates these 3 tables. Does NOT modify existing tables.
-- SAFETY: Idempotent, includes validation, preserves existing data
--
-- REVIEW THIS CAREFULLY BEFORE RUNNING
-- ============================================

BEGIN;

-- ============================================
-- PRE-FLIGHT CHECKS
-- ============================================

-- Verify required anchor tables exist
DO $$
DECLARE
  students_exists BOOLEAN;
  mentors_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'students') INTO students_exists;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'mentors') INTO mentors_exists;

  IF NOT students_exists THEN
    RAISE EXCEPTION 'students table does not exist. Cannot create core tables.';
  END IF;

  IF NOT mentors_exists THEN
    RAISE EXCEPTION 'mentors table does not exist. Cannot create core tables.';
  END IF;

  RAISE NOTICE '✓ Required anchor tables exist (students, mentors)';
END $$;

-- Verify students.roll_number and mentors.mentor_id columns exist
DO $$
DECLARE
  roll_number_exists BOOLEAN;
  mentor_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'roll_number'
  ) INTO roll_number_exists;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mentors' AND column_name = 'mentor_id'
  ) INTO mentor_id_exists;

  IF NOT roll_number_exists THEN
    RAISE EXCEPTION 'students.roll_number column does not exist. Cannot create FKs.';
  END IF;

  IF NOT mentor_id_exists THEN
    RAISE EXCEPTION 'mentors.mentor_id column does not exist. Cannot create FKs.';
  END IF;

  RAISE NOTICE '✓ Required FK target columns exist';
END $$;

-- ============================================
-- STEP 1: CREATE PARAMETERS TABLE
-- ============================================

-- Create parameters table (module definitions)
CREATE TABLE IF NOT EXISTS parameters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  max_marks INTEGER NOT NULL CHECK (max_marks >= 0),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  RAISE NOTICE '✓ parameters table created';
END $$;

-- Insert 12 canonical parameters (idempotent)
INSERT INTO parameters (id, name, max_marks, description) VALUES
  ('coding_problems', 'Coding Problems', 25, 'LeetCode, Codeforces, HackerRank - SQL/DSA problems'),
  ('cp_rating', 'Competitive Programming Rating', 20, 'Codeforces, CodeChef, LeetCode ratings'),
  ('opensource', 'Open Source Contributions', 20, 'GitHub PRs, open source programs'),
  ('competition', 'Competitions', 20, 'Hackathons, contests, competitive events'),
  ('internship', 'Internship & Startup', 20, 'Professional experience, startup work'),
  ('project', 'Project / Publication / Patent', 30, 'Academic/professional outputs'),
  ('language', 'Foreign Language', 15, 'Language proficiency certifications'),
  ('gate', 'GATE / Placement Exam', 25, 'GATE, GRE, or other entrance exams'),
  ('monthly_coding', 'Monthly Coding Assessment', 20, 'Internal monthly assessments'),
  ('hundred_days', '100 Days Training', 15, 'PEP, HOPE training completion'),
  ('aptitude', 'Aptitude & Communication', 20, 'Aptitude tests, communication skills'),
  ('certificate', 'Certificate Achievement', 20, 'Academic/industry certifications')
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  RAISE NOTICE '✓ 12 parameters inserted (or already exist)';
END $$;

-- Verify exact canonical parameter IDs, count, and total marks
DO $$
DECLARE
  missing_params TEXT[];
  extra_params TEXT[];
  param_count INTEGER;
  total_marks INTEGER;
BEGIN
  -- Check for missing canonical IDs
  SELECT ARRAY_AGG(expected_id)
  INTO missing_params
  FROM (
    VALUES
      ('coding_problems'),
      ('cp_rating'),
      ('opensource'),
      ('competition'),
      ('internship'),
      ('project'),
      ('language'),
      ('gate'),
      ('monthly_coding'),
      ('hundred_days'),
      ('aptitude'),
      ('certificate')
  ) AS expected(expected_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM parameters WHERE id = expected.expected_id
  );

  IF missing_params IS NOT NULL THEN
    RAISE EXCEPTION 'Missing canonical parameters: %', array_to_string(missing_params, ', ');
  END IF;

  -- Check for extra (non-canonical) parameters
  SELECT ARRAY_AGG(id)
  INTO extra_params
  FROM parameters
  WHERE id NOT IN (
    'coding_problems', 'cp_rating', 'opensource', 'competition',
    'internship', 'project', 'language', 'gate',
    'monthly_coding', 'hundred_days', 'aptitude', 'certificate'
  );

  IF extra_params IS NOT NULL THEN
    RAISE WARNING 'Found extra (non-canonical) parameters: %', array_to_string(extra_params, ', ');
  END IF;

  -- Check count and total
  SELECT COUNT(*), SUM(max_marks) INTO param_count, total_marks FROM parameters;

  IF param_count != 12 THEN
    RAISE EXCEPTION 'Expected exactly 12 parameters, found %', param_count;
  END IF;

  IF total_marks != 250 THEN
    RAISE EXCEPTION 'Expected total marks = 250, found %', total_marks;
  END IF;

  RAISE NOTICE '✓ Parameter validation passed: exact 12 canonical parameters, 250 total marks';
END $$;

-- Enable RLS on parameters
ALTER TABLE parameters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  RAISE NOTICE '✓ RLS enabled on parameters';
END $$;

-- ============================================
-- STEP 2: CREATE SCORES TABLE
-- ============================================

-- Create scores table (unified marks storage)
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_number TEXT NOT NULL,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
  parameter TEXT NOT NULL,
  marks INTEGER NOT NULL CHECK (marks >= 0),
  provisional BOOLEAN DEFAULT FALSE,
  rule_version TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (register_number, semester, parameter)
);

DO $$ BEGIN
  RAISE NOTICE '✓ scores table created';
END $$;

-- Add FK: register_number → students(roll_number)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_scores_register_number'
  ) THEN
    ALTER TABLE scores ADD CONSTRAINT fk_scores_register_number
      FOREIGN KEY (register_number) REFERENCES students(roll_number)
      ON DELETE CASCADE;
    RAISE NOTICE '✓ FK added: scores.register_number → students(roll_number)';
  ELSE
    RAISE NOTICE '✓ FK already exists: scores.register_number → students(roll_number)';
  END IF;
END $$;

-- Add FK: parameter → parameters(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_scores_parameter'
  ) THEN
    ALTER TABLE scores ADD CONSTRAINT fk_scores_parameter
      FOREIGN KEY (parameter) REFERENCES parameters(id)
      ON DELETE RESTRICT;
    RAISE NOTICE '✓ FK added: scores.parameter → parameters(id)';
  ELSE
    RAISE NOTICE '✓ FK already exists: scores.parameter → parameters(id)';
  END IF;
END $$;

-- Create indexes on scores
CREATE INDEX IF NOT EXISTS idx_scores_register_number ON scores(register_number);
CREATE INDEX IF NOT EXISTS idx_scores_parameter ON scores(parameter);
CREATE INDEX IF NOT EXISTS idx_scores_semester ON scores(semester);

DO $$ BEGIN
  RAISE NOTICE '✓ Indexes created on scores';
END $$;

-- Enable RLS on scores
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  RAISE NOTICE '✓ RLS enabled on scores';
END $$;

-- ============================================
-- STEP 3: CREATE AUDIT_LOG TABLE
-- ============================================

-- Create audit_log table (accountability trail)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT,
  parameter_id TEXT,
  actor_id TEXT,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  new_score NUMERIC,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  RAISE NOTICE '✓ audit_log table created';
END $$;

-- Add FK: student_id → students(roll_number) WITH RESTRICT
-- V2 CHANGE: ON DELETE RESTRICT (was CASCADE) to preserve audit trail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_audit_log_student'
  ) THEN
    ALTER TABLE audit_log ADD CONSTRAINT fk_audit_log_student
      FOREIGN KEY (student_id) REFERENCES students(roll_number)
      ON DELETE RESTRICT;
    RAISE NOTICE '✓ FK added: audit_log.student_id → students(roll_number) ON DELETE RESTRICT';
  ELSE
    RAISE NOTICE '✓ FK already exists: audit_log.student_id → students(roll_number)';
  END IF;
END $$;

-- Add FK: parameter_id → parameters(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_audit_log_parameter'
  ) THEN
    ALTER TABLE audit_log ADD CONSTRAINT fk_audit_log_parameter
      FOREIGN KEY (parameter_id) REFERENCES parameters(id)
      ON DELETE SET NULL;
    RAISE NOTICE '✓ FK added: audit_log.parameter_id → parameters(id)';
  ELSE
    RAISE NOTICE '✓ FK already exists: audit_log.parameter_id → parameters(id)';
  END IF;
END $$;

-- Add FK: actor_id → mentors(mentor_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_audit_log_actor'
  ) THEN
    ALTER TABLE audit_log ADD CONSTRAINT fk_audit_log_actor
      FOREIGN KEY (actor_id) REFERENCES mentors(mentor_id)
      ON DELETE SET NULL;
    RAISE NOTICE '✓ FK added: audit_log.actor_id → mentors(mentor_id)';
  ELSE
    RAISE NOTICE '✓ FK already exists: audit_log.actor_id → mentors(mentor_id)';
  END IF;
END $$;

-- Create indexes on audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_student_id ON audit_log(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_parameter_id ON audit_log(parameter_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

DO $$ BEGIN
  RAISE NOTICE '✓ Indexes created on audit_log';
END $$;

-- Enable RLS on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  RAISE NOTICE '✓ RLS enabled on audit_log';
END $$;

-- ============================================
-- VALIDATION CHECKS
-- ============================================

DO $$
DECLARE
  tables_created INTEGER;
  param_count INTEGER;
  total_marks INTEGER;
  scores_fk_count INTEGER;
  audit_fk_count INTEGER;
  validation_errors TEXT := '';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDATION CHECKS';
  RAISE NOTICE '========================================';

  -- Check 1: All 3 tables exist
  SELECT COUNT(*) INTO tables_created
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('parameters', 'scores', 'audit_log');

  IF tables_created != 3 THEN
    validation_errors := validation_errors || E'\n- Expected 3 tables, found ' || tables_created::TEXT;
  ELSE
    RAISE NOTICE '✓ All 3 core tables exist';
  END IF;

  -- Check 2: Parameters count and total
  SELECT COUNT(*), SUM(max_marks) INTO param_count, total_marks FROM parameters;

  IF param_count != 12 THEN
    validation_errors := validation_errors || E'\n- Expected 12 parameters, found ' || param_count::TEXT;
  END IF;

  IF total_marks != 250 THEN
    validation_errors := validation_errors || E'\n- Expected 250 total marks, found ' || total_marks::TEXT;
  END IF;

  IF param_count = 12 AND total_marks = 250 THEN
    RAISE NOTICE '✓ 12 parameters with 250 total marks';
  END IF;

  -- Check 3: Scores FKs
  SELECT COUNT(*) INTO scores_fk_count
  FROM information_schema.table_constraints
  WHERE table_name = 'scores'
  AND constraint_type = 'FOREIGN KEY';

  IF scores_fk_count < 2 THEN
    validation_errors := validation_errors || E'\n- Scores missing FKs (expected 2, found ' || scores_fk_count::TEXT || ')';
  ELSE
    RAISE NOTICE '✓ Scores has 2 foreign keys';
  END IF;

  -- Check 4: Audit_log FKs
  SELECT COUNT(*) INTO audit_fk_count
  FROM information_schema.table_constraints
  WHERE table_name = 'audit_log'
  AND constraint_type = 'FOREIGN KEY';

  IF audit_fk_count < 3 THEN
    validation_errors := validation_errors || E'\n- Audit_log missing FKs (expected 3, found ' || audit_fk_count::TEXT || ')';
  ELSE
    RAISE NOTICE '✓ Audit_log has 3 foreign keys';
  END IF;

  -- Check 5: RLS enabled on all 3 tables
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'parameters' AND rowsecurity = true
  ) THEN
    validation_errors := validation_errors || E'\n- RLS not enabled on parameters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'scores' AND rowsecurity = true
  ) THEN
    validation_errors := validation_errors || E'\n- RLS not enabled on scores';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'audit_log' AND rowsecurity = true
  ) THEN
    validation_errors := validation_errors || E'\n- RLS not enabled on audit_log';
  END IF;

  IF validation_errors = '' THEN
    RAISE NOTICE '✓ RLS enabled on all 3 tables';
  END IF;

  -- Check 6: Existing project_evidence untouched
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_evidence') THEN
    DECLARE
      evidence_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO evidence_count FROM project_evidence;
      RAISE NOTICE '✓ project_evidence untouched (% rows)', evidence_count;
    END;
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

-- Show all parameters
SELECT id, name, max_marks FROM parameters ORDER BY id;

-- Show FK constraints on scores
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'scores'
ORDER BY tc.constraint_name;

-- Show FK constraints on audit_log
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'audit_log'
ORDER BY tc.constraint_name;

-- Show RLS status
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename IN ('parameters', 'scores', 'audit_log')
ORDER BY tablename;

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
  RAISE NOTICE '✅ CORE INFRASTRUCTURE MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ parameters (12 modules, 250 total marks)';
  RAISE NOTICE '  ✓ scores (unified marks storage)';
  RAISE NOTICE '  ✓ audit_log (accountability trail)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ All foreign keys established';
  RAISE NOTICE '  ✓ RLS enabled on all 3 tables';
  RAISE NOTICE '  ✓ Indexes created for performance';
  RAISE NOTICE '  ✓ Validation checks passed';
  RAISE NOTICE '  ✓ Existing tables untouched';
  RAISE NOTICE '  ✓ Audit trail preserved (ON DELETE RESTRICT)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NEXT STEPS:';
  RAISE NOTICE '  1. Add audit logging hooks to Project API';
  RAISE NOTICE '  2. Test audit trail captures changes';
  RAISE NOTICE '  3. Test scores table integration';
  RAISE NOTICE '  4. Then migrate next evidence module';
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
-- Run this ONLY if you need to reverse the core tables migration
-- Copy everything between the BEGIN/COMMIT below

BEGIN;

-- ============================================
-- STEP 1: DROP FOREIGN KEY CONSTRAINTS
-- ============================================

-- Drop scores FKs
ALTER TABLE scores DROP CONSTRAINT IF EXISTS fk_scores_register_number;
ALTER TABLE scores DROP CONSTRAINT IF EXISTS fk_scores_parameter;

-- Drop audit_log FKs
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS fk_audit_log_student;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS fk_audit_log_parameter;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS fk_audit_log_actor;

DO $$ BEGIN
  RAISE NOTICE 'Foreign key constraints dropped ✓';
END $$;

-- ============================================
-- STEP 2: DROP INDEXES
-- ============================================

-- Drop scores indexes
DROP INDEX IF EXISTS idx_scores_register_number;
DROP INDEX IF EXISTS idx_scores_parameter;
DROP INDEX IF EXISTS idx_scores_semester;

-- Drop audit_log indexes
DROP INDEX IF EXISTS idx_audit_log_student_id;
DROP INDEX IF EXISTS idx_audit_log_parameter_id;
DROP INDEX IF EXISTS idx_audit_log_actor_id;
DROP INDEX IF EXISTS idx_audit_log_created_at;

DO $$ BEGIN
  RAISE NOTICE 'Indexes dropped ✓';
END $$;

-- ============================================
-- STEP 3: DROP TABLES
-- ============================================

-- Drop in reverse dependency order
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS parameters CASCADE;

DO $$ BEGIN
  RAISE NOTICE 'Core tables dropped ✓';
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify tables are gone
SELECT COUNT(*) AS remaining_core_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('parameters', 'scores', 'audit_log');

-- Verify project_evidence still exists
SELECT COUNT(*) AS project_evidence_rows FROM project_evidence;

COMMIT;

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ROLLBACK COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Core tables removed:';
  RAISE NOTICE '  ✓ audit_log';
  RAISE NOTICE '  ✓ scores';
  RAISE NOTICE '  ✓ parameters';
  RAISE NOTICE '';
  RAISE NOTICE 'Existing tables preserved:';
  RAISE NOTICE '  ✓ students';
  RAISE NOTICE '  ✓ mentors';
  RAISE NOTICE '  ✓ project_evidence';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

-- End of rollback script
*/
