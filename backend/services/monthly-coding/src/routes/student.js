const express = require('express');
const router = express.Router();
const supabase = require('../db');

// GET /api/student/:rollNumber
router.get('/:rollNumber', async (req, res) => {
  const normRoll = (req.params.rollNumber || '').trim().toLowerCase();

  // Find student in profiles by id_number
  const { data: students, error: studErr } = await supabase
    .from('profiles')
    .select('id, name, id_number, semester, department')
    .eq('role', 'student');

  if (studErr) return res.status(500).json({ error: 'Internal server error.' });

  const student = (students || []).find(
    s => (s.id_number || '').trim().toLowerCase() === normRoll
  );

  if (!student) return res.status(404).json({ error: 'Student not found.' });

  // Fetch all raw assessment scores, ordered by semester then assessment_no
  const { data: rawScores, error: rawErr } = await supabase
    .from('coding_assessments')
    .select('semester, assessment_no, raw_score, status, created_at')
    .eq('student_id', student.id)
    .eq('status', 'verified')
    .order('semester', { ascending: true })
    .order('assessment_no', { ascending: true });

  if (rawErr) return res.status(500).json({ error: 'Internal server error.' });

  // Fetch converted marks from scores table
  const { data: markRows } = await supabase
    .from('scores')
    .select('semester, marks')
    .eq('register_number', student.id_number)
    .eq('parameter', 'monthly_coding')
    .order('semester', { ascending: true });

  const marksBySem = {};
  (markRows || []).forEach(r => { marksBySem[r.semester] = r.marks; });

  // Group raw scores by semester
  const bySemester = {};
  (rawScores || []).forEach(r => {
    if (!bySemester[r.semester]) bySemester[r.semester] = [];
    bySemester[r.semester].push(parseFloat(r.raw_score));
  });

  // Build cumulative avg per semester for display
  let runningRaw = [];
  const assessments = Object.keys(bySemester)
    .map(Number)
    .sort((a, b) => a - b)
    .map(sem => {
      const semScores = bySemester[sem];
      runningRaw = [...runningRaw, ...semScores];
      const cumulativeAvg = runningRaw.reduce((s, v) => s + v, 0) / runningRaw.length;
      return {
        semester: sem,
        scores: semScores,
        cumulativeAvg: parseFloat(cumulativeAvg.toFixed(2)),
        convertedMark: marksBySem[String(sem)] ?? null,
      };
    });

  return res.json({
    student: {
      name: student.name,
      rollNumber: student.id_number,
      currentSemester: student.semester,
      department: student.department,
    },
    assessments,
  });
});

// GET /api/student/marks/:rollNumber — dashboard marks endpoint
router.get('/marks/:rollNumber', async (req, res) => {
  const normRoll = (req.params.rollNumber || '').trim().toLowerCase();

  const { data: students, error: studErr } = await supabase
    .from('profiles')
    .select('id, name, id_number, semester')
    .eq('role', 'student');

  if (studErr) return res.status(500).json({ error: 'Internal server error.' });

  const student = (students || []).find(
    s => (s.id_number || '').trim().toLowerCase() === normRoll
  );

  if (!student) {
    return res.json({ studentId: req.params.rollNumber, module: 'Monthly Coding Assessment', maxMarks: 20, marks: 0 });
  }

  const { data: markRows } = await supabase
    .from('scores')
    .select('semester, marks')
    .eq('register_number', student.id_number)
    .eq('parameter', 'monthly_coding')
    .order('semester', { ascending: false })
    .limit(1);

  const marks = markRows && markRows.length > 0 ? markRows[0].marks : 0;

  return res.json({
    studentId: req.params.rollNumber,
    module: 'Monthly Coding Assessment',
    maxMarks: 20,
    marks: marks || 0,
  });
});

module.exports = router;
