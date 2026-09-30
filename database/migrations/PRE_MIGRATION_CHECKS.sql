-- ============================================
-- PRE-MIGRATION CHECKS
-- ============================================
-- Run these queries FIRST to identify issues
-- Copy/paste results back to me before proceeding

-- ============================================
-- 1. CHECK PROFILES.ID_NUMBER UNIQUE CONSTRAINT
-- ============================================
SELECT
  con.conname AS constraint_name,
  con.contype AS constraint_type
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'profiles'
  AND con.conname LIKE '%id_number%';

-- Expected: One UNIQUE constraint on id_number


-- ============================================
-- 2. LIST EXISTING TABLES AND STUDENT_ID TYPES
-- ============================================
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name IN ('student_id', 'mentor_id', 'actor_id', 'register_number')
ORDER BY c.table_name, c.column_name;

-- Look for: UUID types that need conversion to TEXT


-- ============================================
-- 3. ORPHAN CHECK - CODING_EVIDENCE
-- ============================================
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coding_evidence') THEN
    SELECT COUNT(*) INTO orphan_count
    FROM coding_evidence ce
    WHERE NOT EXISTS (
      SELECT 1 FROM students s WHERE ce.student_id = s.roll_number
      UNION
      SELECT 1 FROM profiles p WHERE ce.student_id = p.id_number
    );
    RAISE NOTICE 'coding_evidence orphans: %', orphan_count;
  ELSE
    RAISE NOTICE 'coding_evidence table does not exist';
  END IF;
END $$;


-- ============================================
-- 4. ORPHAN CHECK - CODING_ASSESSMENTS
-- ============================================
DO $$
DECLARE
  orphan_count INTEGER;
  col_type TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coding_assessments') THEN
    -- Check column type
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'coding_assessments' AND column_name = 'student_id';

    RAISE NOTICE 'coding_assessments.student_id type: %', col_type;

    -- Check orphans based on type
    IF col_type = 'uuid' THEN
      SELECT COUNT(*) INTO orphan_count
      FROM coding_assessments ca
      WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE ca.student_id = p.id);
      RAISE NOTICE 'coding_assessments orphans (UUID): %', orphan_count;
    ELSE
      SELECT COUNT(*) INTO orphan_count
      FROM coding_assessments ca
      WHERE NOT EXISTS (
        SELECT 1 FROM students s WHERE ca.student_id = s.roll_number
        UNION
        SELECT 1 FROM profiles p WHERE ca.student_id = p.id_number
      );
      RAISE NOTICE 'coding_assessments orphans (TEXT): %', orphan_count;
    END IF;
  ELSE
    RAISE NOTICE 'coding_assessments table does not exist';
  END IF;
END $$;


-- ============================================
-- 5. ORPHAN CHECK - SCORES
-- ============================================
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scores') THEN
    SELECT COUNT(*) INTO orphan_count
    FROM scores s
    WHERE NOT EXISTS (
      SELECT 1 FROM students st WHERE s.register_number = st.roll_number
      UNION
      SELECT 1 FROM profiles p WHERE s.register_number = p.id_number
    );
    RAISE NOTICE 'scores orphans: %', orphan_count;
  ELSE
    RAISE NOTICE 'scores table does not exist';
  END IF;
END $$;


-- ============================================
-- 6. CHECK EXISTING EVIDENCE TABLES
-- ============================================
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public'
   AND columns.table_name = tables.table_name
   AND column_name = 'student_id') AS has_student_id,
  (SELECT data_type FROM information_schema.columns
   WHERE table_schema = 'public'
   AND columns.table_name = tables.table_name
   AND column_name = 'student_id') AS student_id_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%evidence%'
ORDER BY table_name;


-- ============================================
-- 7. CHECK FOR STUDENTS/MENTORS TABLES
-- ============================================
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public'
   AND columns.table_name = tables.table_name) AS column_count,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('students', 'mentors', 'profiles')
ORDER BY table_name;


-- ============================================
-- 8. ROW COUNTS
-- ============================================
DO $$
DECLARE
  tbl TEXT;
  cnt INTEGER;
BEGIN
  FOR tbl IN SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('students', 'mentors', 'profiles', 'coding_evidence',
                       'coding_assessments', 'scores', 'audit_log')
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', tbl) INTO cnt;
    RAISE NOTICE '% rows: %', tbl, cnt;
  END LOOP;
END $$;


-- ============================================
-- PASTE ALL OUTPUT ABOVE BACK TO ME
-- ============================================
