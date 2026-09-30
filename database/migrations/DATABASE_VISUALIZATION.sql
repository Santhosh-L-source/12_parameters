-- ============================================
-- DATABASE VISUALIZATION QUERIES
-- ============================================
-- Comprehensive SQL queries to visualize database structure,
-- relationships, and data for the HOPE Project system.
--
-- Execute these queries in Supabase SQL Editor or any PostgreSQL client
-- ============================================

-- ============================================
-- SECTION 1: TABLE STRUCTURE OVERVIEW
-- ============================================

-- 1.1 List all tables in public schema
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- 1.2 Detailed column information for all tables
SELECT
  table_name,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('students', 'mentors', 'parameters', 'scores', 'audit_log', 'project_evidence')
ORDER BY table_name, ordinal_position;

-- ============================================
-- SECTION 2: FOREIGN KEY RELATIONSHIPS
-- ============================================

-- 2.1 Complete foreign key relationship map
SELECT
  tc.table_name AS "From Table",
  kcu.column_name AS "From Column",
  ccu.table_name AS "To Table",
  ccu.column_name AS "To Column",
  rc.delete_rule AS "On Delete",
  rc.update_rule AS "On Update",
  tc.constraint_name AS "Constraint Name"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- 2.2 Visual relationship diagram (text format)
SELECT
  CONCAT(
    RPAD(tc.table_name, 20, ' '),
    ' → ',
    RPAD(ccu.table_name, 20, ' '),
    ' [', rc.delete_rule, ']'
  ) AS "Relationship Flow"
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- ============================================
-- SECTION 3: PARAMETERS TABLE VISUALIZATION
-- ============================================

-- 3.1 Parameters with marks distribution
SELECT
  id AS "Parameter ID",
  name AS "Module Name",
  max_marks AS "Max Marks",
  RPAD('█', (max_marks::float / 30 * 20)::int, '█') AS "Visual Bar",
  ROUND((max_marks::numeric / 250 * 100), 1) || '%' AS "% of Total"
FROM parameters
ORDER BY max_marks DESC, id;

-- 3.2 Parameters summary statistics
SELECT
  COUNT(*) AS "Total Parameters",
  SUM(max_marks) AS "Total Marks",
  AVG(max_marks) AS "Average Marks",
  MIN(max_marks) AS "Min Marks",
  MAX(max_marks) AS "Max Marks"
FROM parameters;

-- 3.3 Parameters by marks range
SELECT
  CASE
    WHEN max_marks < 20 THEN '< 20 marks'
    WHEN max_marks = 20 THEN '20 marks'
    WHEN max_marks BETWEEN 21 AND 25 THEN '21-25 marks'
    ELSE '> 25 marks'
  END AS "Marks Range",
  COUNT(*) AS "Count",
  STRING_AGG(id, ', ' ORDER BY id) AS "Parameters"
FROM parameters
GROUP BY
  CASE
    WHEN max_marks < 20 THEN '< 20 marks'
    WHEN max_marks = 20 THEN '20 marks'
    WHEN max_marks BETWEEN 21 AND 25 THEN '21-25 marks'
    ELSE '> 25 marks'
  END
ORDER BY MIN(max_marks);

-- ============================================
-- SECTION 4: DATA DISTRIBUTION
-- ============================================

-- 4.1 Record counts across all tables
SELECT 'students' AS "Table", COUNT(*) AS "Record Count" FROM students
UNION ALL
SELECT 'mentors', COUNT(*) FROM mentors
UNION ALL
SELECT 'parameters', COUNT(*) FROM parameters
UNION ALL
SELECT 'scores', COUNT(*) FROM scores
UNION ALL
SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL
SELECT 'project_evidence', COUNT(*) FROM project_evidence
ORDER BY "Record Count" DESC;

-- 4.2 Evidence status distribution
SELECT
  status AS "Status",
  COUNT(*) AS "Count",
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM project_evidence), 1) AS "Percentage",
  RPAD('█', COUNT(*)::int * 5, '█') AS "Visual"
FROM project_evidence
GROUP BY status
ORDER BY COUNT(*) DESC;

-- 4.3 Evidence by student
SELECT
  student_id AS "Student",
  COUNT(*) AS "Total Evidence",
  SUM(CASE WHEN status = 'VERIFIED' THEN 1 ELSE 0 END) AS "Verified",
  SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS "Rejected",
  SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS "Pending"
FROM project_evidence
GROUP BY student_id
ORDER BY COUNT(*) DESC;

-- ============================================
-- SECTION 5: AUDIT TRAIL VISUALIZATION
-- ============================================

-- 5.1 Audit log summary by action
SELECT
  action AS "Action",
  COUNT(*) AS "Count",
  STRING_AGG(DISTINCT student_id, ', ' ORDER BY student_id) AS "Students Affected"
FROM audit_log
GROUP BY action
ORDER BY COUNT(*) DESC;

-- 5.2 Audit timeline (most recent first)
SELECT
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS "Timestamp",
  student_id AS "Student",
  parameter_id AS "Parameter",
  action AS "Action",
  old_value->>'status' AS "Old Status",
  new_value->>'status' AS "New Status",
  actor_id AS "Actor"
FROM audit_log
ORDER BY created_at DESC
LIMIT 20;

-- 5.3 Audit activity by parameter
SELECT
  parameter_id AS "Parameter",
  COUNT(*) AS "Audit Entries",
  STRING_AGG(DISTINCT action, ', ' ORDER BY action) AS "Actions Recorded"
FROM audit_log
GROUP BY parameter_id
ORDER BY COUNT(*) DESC;

-- ============================================
-- SECTION 6: STUDENT PERFORMANCE OVERVIEW
-- ============================================

-- 6.1 Student marks summary (from verified evidence)
SELECT
  pe.student_id AS "Student ID",
  s.name AS "Student Name",
  COUNT(pe.id) AS "Verified Evidence",
  SUM(pe.stage_marks) AS "Total Marks",
  p.max_marks AS "Module Max",
  ROUND((SUM(pe.stage_marks)::numeric / p.max_marks * 100), 1) AS "Completion %"
FROM project_evidence pe
JOIN students s ON pe.student_id = s.roll_number
CROSS JOIN (SELECT max_marks FROM parameters WHERE id = 'project') p
WHERE pe.status = 'VERIFIED'
GROUP BY pe.student_id, s.name, p.max_marks
ORDER BY SUM(pe.stage_marks) DESC;

-- 6.2 Evidence achievement breakdown by type
SELECT
  achievement_type AS "Type",
  COUNT(*) AS "Total",
  SUM(CASE WHEN status = 'VERIFIED' THEN 1 ELSE 0 END) AS "Verified",
  SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS "Rejected",
  SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS "Pending",
  AVG(stage_marks) AS "Avg Marks"
FROM project_evidence
GROUP BY achievement_type
ORDER BY COUNT(*) DESC;

-- ============================================
-- SECTION 7: SCORES TABLE VISUALIZATION
-- ============================================

-- 7.1 Scores distribution by parameter
SELECT
  parameter AS "Parameter",
  COUNT(*) AS "Score Records",
  AVG(marks) AS "Average Marks",
  MIN(marks) AS "Min Marks",
  MAX(marks) AS "Max Marks"
FROM scores
GROUP BY parameter
ORDER BY COUNT(*) DESC;

-- 7.2 Scores by student and semester
SELECT
  register_number AS "Student",
  semester AS "Semester",
  COUNT(*) AS "Parameters Scored",
  SUM(marks) AS "Total Marks",
  ROUND(AVG(marks), 2) AS "Average Marks"
FROM scores
GROUP BY register_number, semester
ORDER BY register_number, semester;

-- 7.3 Provisional vs Final scores
SELECT
  provisional AS "Provisional",
  COUNT(*) AS "Count",
  AVG(marks) AS "Average Marks"
FROM scores
GROUP BY provisional
ORDER BY provisional;

-- ============================================
-- SECTION 8: SECURITY & CONSTRAINTS
-- ============================================

-- 8.1 Row Level Security (RLS) status
SELECT
  tablename AS "Table",
  CASE WHEN rowsecurity THEN '✓ ENABLED' ELSE '✗ DISABLED' END AS "RLS Status"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('students', 'mentors', 'parameters', 'scores', 'audit_log', 'project_evidence')
ORDER BY tablename;

-- 8.2 Primary keys
SELECT
  tc.table_name AS "Table",
  STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS "Primary Key Columns"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_name IN ('students', 'mentors', 'parameters', 'scores', 'audit_log', 'project_evidence')
GROUP BY tc.table_name
ORDER BY tc.table_name;

-- 8.3 Unique constraints
SELECT
  tc.table_name AS "Table",
  tc.constraint_name AS "Constraint Name",
  STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS "Unique Columns"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN ('students', 'mentors', 'parameters', 'scores', 'audit_log', 'project_evidence')
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- 8.4 Check constraints
SELECT
  tc.table_name AS "Table",
  tc.constraint_name AS "Constraint Name",
  cc.check_clause AS "Check Condition"
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'CHECK'
  AND tc.table_name IN ('students', 'mentors', 'parameters', 'scores', 'audit_log', 'project_evidence')
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- SECTION 9: INDEXES
-- ============================================

-- 9.1 All indexes on core tables
SELECT
  schemaname AS "Schema",
  tablename AS "Table",
  indexname AS "Index Name",
  indexdef AS "Index Definition"
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('students', 'mentors', 'parameters', 'scores', 'audit_log', 'project_evidence')
ORDER BY tablename, indexname;

-- ============================================
-- SECTION 10: DETAILED SAMPLE DATA
-- ============================================

-- 10.1 Students with their evidence summary
SELECT
  s.roll_number AS "Roll Number",
  s.name AS "Name",
  s.email AS "Email",
  COUNT(DISTINCT pe.id) AS "Evidence Count",
  STRING_AGG(DISTINCT pe.status, ', ' ORDER BY pe.status) AS "Statuses",
  STRING_AGG(DISTINCT pe.semester::text, ', ' ORDER BY pe.semester::text) AS "Semesters"
FROM students s
LEFT JOIN project_evidence pe ON s.roll_number = pe.student_id
GROUP BY s.roll_number, s.name, s.email
ORDER BY s.roll_number;

-- 10.2 Mentors with their review activity
SELECT
  m.mentor_id AS "Mentor ID",
  m.name AS "Name",
  m.email AS "Email",
  COUNT(DISTINCT pe.id) AS "Evidence Reviewed",
  COUNT(DISTINCT al.id) AS "Audit Entries"
FROM mentors m
LEFT JOIN project_evidence pe ON m.mentor_id = pe.mentor_id
LEFT JOIN audit_log al ON m.mentor_id = al.actor_id
GROUP BY m.mentor_id, m.name, m.email
ORDER BY m.mentor_id;

-- 10.3 Complete evidence records with relationships
SELECT
  pe.id AS "ID",
  pe.student_id AS "Student",
  s.name AS "Student Name",
  pe.achievement_type AS "Type",
  pe.output_name AS "Output",
  pe.achievement_stage AS "Stage",
  pe.stage_marks AS "Marks",
  pe.status AS "Status",
  pe.mentor_id AS "Mentor",
  m.name AS "Mentor Name",
  TO_CHAR(pe.verified_at, 'YYYY-MM-DD') AS "Verified Date"
FROM project_evidence pe
LEFT JOIN students s ON pe.student_id = s.roll_number
LEFT JOIN mentors m ON pe.mentor_id = m.mentor_id
ORDER BY pe.id;

-- ============================================
-- SECTION 11: DATABASE STATISTICS
-- ============================================

-- 11.1 Table sizes
SELECT
  schemaname AS "Schema",
  tablename AS "Table",
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS "Total Size",
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS "Table Size",
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS "Indexes Size"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('students', 'mentors', 'parameters', 'scores', 'audit_log', 'project_evidence')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 11.2 Database metadata
SELECT
  current_database() AS "Database",
  current_schema() AS "Schema",
  version() AS "PostgreSQL Version",
  NOW() AS "Current Timestamp";

-- ============================================
-- SECTION 12: ENTITY RELATIONSHIP DIAGRAM (TEXT)
-- ============================================

-- Visual representation of relationships
SELECT '
╔═══════════════════╗
║    STUDENTS       ║
║  roll_number (PK) ║
║  name             ║
║  email            ║
║  semester         ║
╚═══════════════════╝
         ║
         ║ (1:N)
         ║
         ▼
╔═══════════════════╗        ╔═══════════════════╗
║ PROJECT_EVIDENCE  ║        ║    MENTORS        ║
║  id (PK)          ║◄───────║  mentor_id (PK)   ║
║  student_id (FK)  ║        ║  name             ║
║  mentor_id (FK)   ║        ║  email            ║
║  achievement_type ║        ║  department       ║
║  status           ║        ╚═══════════════════╝
║  stage_marks      ║
╚═══════════════════╝
         ║
         ║ (triggers)
         ║
         ▼
╔═══════════════════╗
║    AUDIT_LOG      ║
║  id (PK)          ║
║  student_id (FK)  ║──────► students.roll_number [RESTRICT]
║  parameter_id (FK)║──────► parameters.id [SET NULL]
║  actor_id (FK)    ║──────► mentors.mentor_id [SET NULL]
║  action           ║
║  old_value        ║
║  new_value        ║
╚═══════════════════╝

╔═══════════════════╗        ╔═══════════════════╗
║    PARAMETERS     ║        ║      SCORES       ║
║  id (PK)          ║◄───────║  id (PK)          ║
║  name             ║        ║  register_number  ║──► students.roll_number
║  max_marks        ║        ║  semester         ║
║  description      ║        ║  parameter (FK)   ║──► parameters.id
╚═══════════════════╝        ║  marks            ║
                             ║  provisional      ║
                             ╚═══════════════════╝

KEY:
  (PK) = Primary Key
  (FK) = Foreign Key
  ──► = Foreign Key Reference
  [RESTRICT] = ON DELETE RESTRICT
  [SET NULL] = ON DELETE SET NULL
  (1:N) = One to Many Relationship
' AS "Entity Relationship Diagram";

-- ============================================
-- SECTION 13: VERIFICATION QUERIES
-- ============================================

-- 13.1 Check data integrity
SELECT
  'Data Integrity Check' AS "Test",
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS'
    ELSE '✗ FAIL: ' || COUNT(*) || ' orphaned records'
  END AS "Result"
FROM project_evidence pe
LEFT JOIN students s ON pe.student_id = s.roll_number
WHERE s.roll_number IS NULL

UNION ALL

SELECT
  'FK Integrity (Mentors)',
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS'
    ELSE '✗ FAIL: ' || COUNT(*) || ' invalid references'
  END
FROM project_evidence pe
LEFT JOIN mentors m ON pe.mentor_id = m.mentor_id
WHERE pe.mentor_id IS NOT NULL AND m.mentor_id IS NULL

UNION ALL

SELECT
  'Parameter Count',
  CASE
    WHEN COUNT(*) = 12 THEN '✓ PASS: 12 parameters'
    ELSE '✗ FAIL: ' || COUNT(*) || ' parameters (expected 12)'
  END
FROM parameters

UNION ALL

SELECT
  'Parameter Total Marks',
  CASE
    WHEN SUM(max_marks) = 250 THEN '✓ PASS: 250 marks'
    ELSE '✗ FAIL: ' || SUM(max_marks) || ' marks (expected 250)'
  END
FROM parameters;

-- ============================================
-- END OF VISUALIZATION QUERIES
-- ============================================

-- Summary note
SELECT '
✅ DATABASE VISUALIZATION COMPLETE

All queries executed successfully. Review the results above to understand:
- Database structure and relationships
- Data distribution and statistics
- Foreign key constraints and referential integrity
- Audit trail and security settings
- Sample data and entity relationships

For further analysis, re-run specific sections as needed.
' AS "Summary";
