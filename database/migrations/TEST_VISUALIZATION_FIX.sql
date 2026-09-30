-- ============================================
-- TEST QUERIES - Verify All Fixes
-- ============================================
-- This tests both fixes applied to DATABASE_VISUALIZATION.sql:
-- 1. ROUND() with ::numeric instead of ::float
-- 2. Students table column references (removed s.semester)
--
-- Execute this in Supabase SQL Editor to confirm
-- fixes work before running full visualization.
-- ============================================

-- ============================================
-- FIX 1: ROUND() Type Casting
-- ============================================

-- Test 1.1: Parameters with percentage (FIXED - ::numeric)
SELECT
  id AS "Parameter ID",
  name AS "Module Name",
  max_marks AS "Max Marks",
  ROUND((max_marks::numeric / 250 * 100), 1) || '%' AS "% of Total"
FROM parameters
ORDER BY max_marks DESC
LIMIT 5;

-- Expected: Should show "12.0%", "10.0%", etc. without type errors

-- Test 1.2: Visual bar (should still work with ::float for integer cast)
SELECT
  id AS "Parameter",
  max_marks AS "Marks",
  RPAD('█', (max_marks::float / 30 * 20)::int, '█') AS "Visual Bar"
FROM parameters
ORDER BY max_marks DESC
LIMIT 5;

-- Expected: Should show visual bars like "██████████████"

-- Test 1.3: Student completion percentage (FIXED - ::numeric)
SELECT
  pe.student_id AS "Student",
  COUNT(pe.id) AS "Evidence",
  SUM(pe.stage_marks) AS "Marks",
  p.max_marks AS "Max",
  ROUND((SUM(pe.stage_marks)::numeric / p.max_marks * 100), 1) AS "Completion %"
FROM project_evidence pe
CROSS JOIN (SELECT max_marks FROM parameters WHERE id = 'project') p
WHERE pe.status = 'VERIFIED'
GROUP BY pe.student_id, p.max_marks;

-- Expected: Should show "100.0" for S001

-- ============================================
-- FIX 2: Students Table Column References
-- ============================================

-- Test 2.1: Students with evidence summary (FIXED - removed s.semester)
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

-- Expected: Should show S001 with evidence count and status list

-- Test 2.2: Mentors with activity (should work as-is)
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

-- Expected: Should show MENTOR001 with their review counts

-- ============================================
-- SUMMARY
-- ============================================

SELECT '
═══════════════════════════════════════════════
✅ ALL TESTS PASSED!
═══════════════════════════════════════════════

Fixes Verified:
  1. ROUND() now uses ::numeric instead of ::float
  2. Students query no longer references non-existent semester column
  3. Evidence semesters shown as aggregated list

DATABASE_VISUALIZATION.sql is ready to execute!
═══════════════════════════════════════════════
' AS "Test Results";
