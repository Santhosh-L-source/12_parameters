const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { randomUUID } = require('crypto');
const supabase = require('../db');
const { calculateResult } = require('../services/scoring');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function normalize(str) {
  return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function logAudit({ studentId, parameterId, action, newScore, note }) {
  const { error } = await supabase.from('audit_log').insert({
    student_id: studentId,
    parameter_id: parameterId,
    action,
    new_score: newScore,
    note,
  });
  if (error) console.warn('Audit log failed:', error.message);
}

// Shared row submission logic; allStudents must be pre-fetched
async function processStudentRow({ mentorName, studentName, rollNumber, semester, score1, score2, score3, allStudents }) {
  const sem = parseInt(semester, 10);
  if (isNaN(sem) || sem < 1 || sem > 6) {
    return { success: false, error: 'Semester must be 1–6.' };
  }

  const scores = [score1, score2, score3].map(Number);
  if (scores.some(v => isNaN(v) || v < 0 || v > 100)) {
    return { success: false, error: 'Each score must be 0–100.' };
  }

  const normName = normalize(studentName);
  const normRoll = normalize(rollNumber);

  // Try exact name + roll match first; fall back to roll-only match
  let matched = (allStudents || []).filter(
    s => normalize(s.id_number) === normRoll && normalize(s.name) === normName
  );
  if (matched.length === 0) {
    matched = (allStudents || []).filter(s => normalize(s.id_number) === normRoll);
  }

  if (matched.length === 0) {
    return { success: false, error: 'No student found with that roll number.' };
  }
  if (matched.length > 1) {
    return { success: false, error: 'Ambiguous: multiple students match.' };
  }

  const student = matched[0];

  const { data: existing } = await supabase
    .from('coding_assessments')
    .select('assessment_no')
    .eq('student_id', student.id)
    .eq('semester', sem);

  if (existing && existing.length >= 3) {
    return { success: false, error: `Semester ${sem}: all 3 assessments already recorded.`, alreadyExists: true };
  }
  if (existing && existing.length > 0) {
    return { success: false, error: `Semester ${sem}: ${existing.length} assessment(s) already recorded.` };
  }

  const { data: priorRows } = await supabase
    .from('coding_assessments')
    .select('raw_score')
    .eq('student_id', student.id)
    .lt('semester', sem)
    .eq('status', 'verified');

  const priorRawScores = (priorRows || []).map(r => parseFloat(r.raw_score));
  const { cumulativeAvg, convertedMark } = calculateResult(priorRawScores, ...scores);

  const insertRows = [1, 2, 3].map((n, i) => ({
    student_id: student.id,
    semester: sem,
    assessment_no: n,
    raw_score: scores[i],
    status: 'verified',
    published_by: mentorName ? `${mentorName} (Mentor)` : 'Central Placement Team',
  }));

  const { error: insertErr } = await supabase.from('coding_assessments').insert(insertRows);
  if (insertErr) return { success: false, error: 'Failed to save scores. Please try again.' };

  await supabase.from('scores').upsert(
    {
      register_number: student.id_number,
      semester: String(sem),
      parameter: 'monthly_coding',
      marks: convertedMark,
    },
    { onConflict: 'register_number,semester,parameter' }
  );

  await logAudit({
    studentId: student.id,
    parameterId: 'monthly_coding',
    action: 'submit_assessment',
    newScore: convertedMark,
    note: `Sem ${sem} | Raw: ${scores.join(', ')} | CumAvg: ${cumulativeAvg.toFixed(2)} | Mark: ${convertedMark}/20 | By: ${mentorName || 'unknown'}`,
  });

  return {
    success: true,
    studentName: student.name,
    rollNumber: student.id_number,
    semester: sem,
    scores,
    cumulativeAvg: parseFloat(cumulativeAvg.toFixed(2)),
    convertedMark,
  };
}

// ─── File parsers ────────────────────────────────────────────────────────────

function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/[\s_\-\.]+/g, '');
}

function findKey(row, candidates) {
  for (const [k, v] of Object.entries(row)) {
    const n = normalizeHeader(k);
    if (candidates.some(c => n === c || n.includes(c))) return String(v ?? '').trim();
  }
  return '';
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows
    .map(row => ({
      studentName: findKey(row, ['studentname', 'fullname', 'name', 'student']),
      rollNumber: findKey(row, ['rollno', 'rollnumber', 'roll', 'registernumber', 'registerno', 'idnumber', 'regno', 'id']),
      score1: findKey(row, ['score1', 'marks1', 's1', 'assessment1', 'test1', 'ca1']),
      score2: findKey(row, ['score2', 'marks2', 's2', 'assessment2', 'test2', 'ca2']),
      score3: findKey(row, ['score3', 'marks3', 's3', 'assessment3', 'test3', 'ca3']),
    }))
    .filter(r => r.studentName && r.rollNumber);
}

function parseTextTable(text) {
  const rows = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);

  // Skip header line if it contains non-numeric text in score positions
  let start = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if ((lower.includes('name') || lower.includes('student')) &&
        (lower.includes('roll') || lower.includes('register') || lower.includes('id'))) {
      start = i + 1;
      break;
    }
  }

  for (const line of lines.slice(start)) {
    const parsed = parseDataLine(line);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

function parseDataLine(line) {
  const delimiters = ['\t', '|', ','];

  for (const d of delimiters) {
    const parts = line.split(d).map(s => s.trim()).filter(s => s.length > 0);
    const result = tryMapParts(parts);
    if (result) return result;
  }

  // Multiple-space (fixed-width or aligned) — try 2+ spaces as delimiter
  const parts = line.split(/\s{2,}/).map(s => s.trim()).filter(s => s.length > 0);
  return tryMapParts(parts);
}

function tryMapParts(parts) {
  if (parts.length < 5) return null;

  // Case: exactly 5 columns → name, roll, s1, s2, s3
  if (parts.length === 5) {
    const scores = parts.slice(2).map(Number);
    if (scores.every(s => !isNaN(s) && s >= 0 && s <= 100)) {
      return { studentName: parts[0], rollNumber: parts[1], score1: scores[0], score2: scores[1], score3: scores[2] };
    }
  }

  // Case: more columns — last 3 are scores, second-to-last-3 is roll, rest is name
  const scores = parts.slice(-3).map(Number);
  if (scores.every(s => !isNaN(s) && s >= 0 && s <= 100)) {
    const rollNumber = parts[parts.length - 4];
    const studentName = parts.slice(0, parts.length - 4).join(' ');
    if (studentName && rollNumber) {
      return { studentName, rollNumber, score1: scores[0], score2: scores[1], score3: scores[2] };
    }
  }

  return null;
}

async function parseFile(file) {
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheet') || mime.includes('excel')) {
    return { rows: parseXlsx(file.buffer), format: 'xlsx' };
  }

  if (ext === 'docx' || mime.includes('wordprocessingml') || mime.includes('msword')) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { rows: parseTextTable(result.value), format: 'docx' };
  }

  if (ext === 'pdf' || mime.includes('pdf')) {
    const result = await pdfParse(file.buffer);
    return { rows: parseTextTable(result.text), format: 'pdf' };
  }

  if (ext === 'csv' || mime.includes('csv') || mime.includes('text/plain')) {
    return { rows: parseXlsx(file.buffer), format: 'csv' };
  }

  return { rows: parseXlsx(file.buffer), format: ext || 'unknown' };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/mentor/submit
router.post('/submit', async (req, res) => {
  const { mentorName, studentName, rollNumber, semester, score1, score2, score3 } = req.body;

  const missing = ['studentName', 'rollNumber', 'semester', 'score1', 'score2', 'score3'].filter(
    k => req.body[k] === undefined || req.body[k] === null || req.body[k] === ''
  );
  if (missing.length) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }

  const { data: allStudents, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, name, id_number')
    .eq('role', 'student');

  if (fetchErr) {
    console.error(fetchErr);
    return res.status(500).json({ error: 'Internal server error.' });
  }

  const result = await processStudentRow({
    mentorName, studentName, rollNumber, semester, score1, score2, score3, allStudents,
  });

  if (!result.success) {
    const status = result.error.includes('No student found') ? 404
      : result.error.includes('Ambiguous') || result.error.includes('already recorded') ? 409
      : 400;
    return res.status(status).json({ error: result.error });
  }

  return res.status(201).json({ message: 'Assessment saved.', ...result });
});

// POST /api/mentor/bulk-upload
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const { mentorName, semester } = req.body;
  const sem = parseInt(semester, 10);
  if (isNaN(sem) || sem < 1 || sem > 6) {
    return res.status(400).json({ error: 'Select a valid semester (1–6).' });
  }

  let rows, format;
  try {
    ({ rows, format } = await parseFile(req.file));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (!rows.length) {
    return res.status(400).json({
      error: 'No data rows found. Make sure the file has columns: Student Name, Roll Number, Score 1, Score 2, Score 3.',
    });
  }

  // ── 1. Fetch all students once ────────────────────────────────────────────
  const { data: allStudents, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, name, id_number')
    .eq('role', 'student');

  if (fetchErr) {
    console.error(fetchErr);
    return res.status(500).json({ error: 'Internal server error.' });
  }

  // Roll-number → student map (case-insensitive)
  const studentByRoll = new Map();
  for (const s of (allStudents || [])) {
    const key = normalize(s.id_number);
    if (!studentByRoll.has(key)) studentByRoll.set(key, s);
  }

  // ── 2. Validate & match rows in memory ────────────────────────────────────
  const validRows = [];
  const results = [];

  for (const row of rows) {
    if (!row.rollNumber) {
      results.push({ studentName: row.studentName || '—', rollNumber: '—', success: false, error: 'Missing roll number.' });
      continue;
    }

    const scores = [row.score1, row.score2, row.score3].map(Number);
    if (scores.some(v => isNaN(v) || v < 0 || v > 100)) {
      results.push({ studentName: row.studentName || '—', rollNumber: row.rollNumber, success: false, error: 'Invalid scores (each must be 0–100).' });
      continue;
    }

    const student = studentByRoll.get(normalize(row.rollNumber));
    if (!student) {
      results.push({ studentName: row.studentName || '—', rollNumber: row.rollNumber, success: false, error: 'No student found with that roll number.' });
      continue;
    }

    validRows.push({ row, student, scores });
  }

  if (validRows.length) {
    const matchedIds = [...new Set(validRows.map(r => r.student.id))];

    // ── 3. One query: existing assessments for this semester ─────────────────
    const { data: existingAssessments } = await supabase
      .from('coding_assessments')
      .select('student_id')
      .in('student_id', matchedIds)
      .eq('semester', sem);

    const alreadyRecorded = new Set((existingAssessments || []).map(a => a.student_id));

    // ── 4. One query: prior raw scores for cumulative avg ────────────────────
    const { data: priorAssessments } = await supabase
      .from('coding_assessments')
      .select('student_id, raw_score')
      .in('student_id', matchedIds)
      .lt('semester', sem)
      .eq('status', 'verified');

    const priorByStudent = {};
    for (const a of (priorAssessments || [])) {
      if (!priorByStudent[a.student_id]) priorByStudent[a.student_id] = [];
      priorByStudent[a.student_id].push(parseFloat(a.raw_score));
    }

    // ── 5. Build batch payloads ───────────────────────────────────────────────
    const toInsert = [];
    const toUpsertScores = [];
    const toAudit = [];
    const publishedBy = mentorName ? `${mentorName} (Mentor)` : 'Central Placement Team';

    for (const { row, student, scores } of validRows) {
      if (alreadyRecorded.has(student.id)) {
        results.push({
          studentName: student.name, rollNumber: student.id_number,
          score1: row.score1, score2: row.score2, score3: row.score3,
          success: false, alreadyExists: true,
          error: `Semester ${sem}: assessments already recorded.`,
        });
        continue;
      }

      const priorRaw = priorByStudent[student.id] || [];
      const { cumulativeAvg, convertedMark } = calculateResult(priorRaw, ...scores);

      toInsert.push(
        { student_id: student.id, semester: sem, assessment_no: 1, raw_score: scores[0], status: 'verified', published_by: publishedBy },
        { student_id: student.id, semester: sem, assessment_no: 2, raw_score: scores[1], status: 'verified', published_by: publishedBy },
        { student_id: student.id, semester: sem, assessment_no: 3, raw_score: scores[2], status: 'verified', published_by: publishedBy },
      );

      toUpsertScores.push({
        register_number: student.id_number,
        semester: String(sem),
        parameter: 'monthly_coding',
        marks: convertedMark,
      });

      toAudit.push({
        student_id: student.id,
        parameter_id: 'monthly_coding',
        action: 'submit_assessment',
        new_score: convertedMark,
        note: `Bulk | Sem ${sem} | Raw: ${scores.join(', ')} | CumAvg: ${cumulativeAvg.toFixed(2)} | Mark: ${convertedMark}/20 | By: ${mentorName || 'unknown'}`,
      });

      results.push({
        studentName: student.name, rollNumber: student.id_number,
        score1: row.score1, score2: row.score2, score3: row.score3,
        success: true, scores,
        cumulativeAvg: parseFloat(cumulativeAvg.toFixed(2)),
        convertedMark,
      });
    }

    // ── 6. Three batch writes (not per-row) ───────────────────────────────────
    if (toInsert.length) {
      const { error: insertErr } = await supabase.from('coding_assessments').insert(toInsert);
      if (insertErr) {
        console.error('Bulk insert error:', insertErr);
        return res.status(500).json({ error: 'Failed to save scores. Please try again.' });
      }
    }

    if (toUpsertScores.length) {
      await supabase.from('scores').upsert(toUpsertScores, { onConflict: 'register_number,semester,parameter' });
    }

    if (toAudit.length) {
      await supabase.from('audit_log').insert(toAudit);
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success && !r.alreadyExists).length;
  const skipped = results.filter(r => r.alreadyExists).length;

  return res.status(200).json({ format, total: rows.length, succeeded, failed, skipped, results });
});

// GET /api/mentor/students
router.get('/students', async (_req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, id_number, semester, department')
    .eq('role', 'student')
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: 'Internal server error.' });
  res.json(data);
});

// POST /api/mentor/import-students
// Accepts a file with Student Name + Roll Number columns and upserts into profiles
router.post('/import-students', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  let rows, format;
  try {
    ({ rows, format } = await parseFile(req.file));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const students = rows
    .filter(r => r.studentName && r.rollNumber)
    .map(r => ({
      id: randomUUID(),
      name: r.studentName.trim(),
      id_number: r.rollNumber.trim(),
      role: 'student',
    }));

  if (!students.length) {
    return res.status(400).json({
      error: 'No valid rows found. File needs "Student Name" and "Roll Number" columns.',
    });
  }

  // Upsert: update name for existing roll numbers, insert new ones
  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert(students, { onConflict: 'id_number', ignoreDuplicates: false });

  if (upsertErr) {
    return res.status(500).json({ error: `Import failed: ${upsertErr.message}` });
  }

  return res.json({
    imported: students.length,
    format,
    message: `${students.length} student records imported successfully.`,
  });
});

module.exports = router;
