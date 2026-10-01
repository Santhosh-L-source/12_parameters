const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { body } = require('express-validator');
const sequelize = require('../config/database');
const fs = require('fs');
const path = require('path');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Enforce authentication & ADMIN role on all admin endpoints
router.use(authenticate);
router.use(requireRole('admin'));

const os = require('os');

// Configure multer for file upload
const upload = multer({
  dest: path.join(os.tmpdir(), 'hope_excel_uploads'),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
    cb(null, true);
  }
});

// Validation middleware
function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

/**
 * Ensure import_jobs tracking table exists
 */
async function ensureImportJobsTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS import_jobs (
        id VARCHAR(100) PRIMARY KEY,
        job_type VARCHAR(50) DEFAULT 'monthly_coding_upload',
        status VARCHAR(50) DEFAULT 'PROCESSING',
        total_rows INT DEFAULT 0,
        processed_rows INT DEFAULT 0,
        failed_rows INT DEFAULT 0,
        summary JSONB,
        error_log JSONB,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `);
  } catch (err) {
    console.error('[IMPORT_JOBS] Table creation error:', err.message);
  }
}
ensureImportJobsTable();

/**
 * Background worker for bulk processing monthly coding assessment data
 */
async function processImportJobInBackground({
  jobId,
  rawData,
  headerRowIndex,
  rollColIdx,
  nameColIdx,
  scoreColIdx,
  semester,
  month,
  uploadedBy,
  filePath
}) {
  const startTime = Date.now();
  const currentYear = new Date().getFullYear();
  const cycleMonth = String(month || 'Monthly Assessment').trim();
  const distinct_key = `${currentYear}_${cycleMonth.toUpperCase().replace(/\s+/g, '_')}`;

  const results = {
    totalRows: 0,
    processed: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: []
  };

  try {
    const rows = rawData.slice(headerRowIndex + 1).filter(r => r.some(cell => cell !== ''));
    results.totalRows = rows.length;

    // Extract all unique roll numbers from the file for a single bulk query
    const allRollsInFile = Array.from(new Set(
      rows
        .map(r => r[rollColIdx] !== undefined ? String(r[rollColIdx]).trim().toUpperCase() : '')
        .filter(Boolean)
    ));

    console.log(`[JOB ${jobId}] Starting bulk import: ${rows.length} rows, ${allRollsInFile.length} distinct roll numbers`);

    // 1. One bulk lookup for all roll numbers from profiles table
    let matchingProfiles = [];
    if (allRollsInFile.length > 0) {
      matchingProfiles = await sequelize.query(
        `SELECT id_number, register_number, name, department 
         FROM profiles 
         WHERE UPPER(TRIM(id_number)) = ANY(ARRAY[:allRollsInFile]::text[]) 
            OR UPPER(TRIM(register_number)) = ANY(ARRAY[:allRollsInFile]::text[])`,
        {
          replacements: { allRollsInFile },
          type: sequelize.QueryTypes.SELECT
        }
      );
    }

    const profileMap = new Map();
    for (const p of matchingProfiles) {
      if (p.id_number) profileMap.set(String(p.id_number).trim().toUpperCase(), p);
      if (p.register_number) profileMap.set(String(p.register_number).trim().toUpperCase(), p);
    }

    // 2. One bulk fetch of existing evidence for all matched students
    const matchedRolls = Array.from(new Set(matchingProfiles.map(p => p.id_number)));
    let existingEvidence = [];
    if (matchedRolls.length > 0) {
      existingEvidence = await sequelize.query(
        `SELECT id, student_id, distinct_key, percentage, status 
         FROM monthly_coding_evidence 
         WHERE student_id = ANY(ARRAY[:matchedRolls]::text[])`,
        {
          replacements: { matchedRolls },
          type: sequelize.QueryTypes.SELECT
        }
      );
    }

    const evidenceKeyMap = new Map(); // student_id + '_' + distinct_key -> id
    const studentVerifiedPcts = new Map(); // student_id -> array of { key, pct }

    for (const ev of existingEvidence) {
      const sId = String(ev.student_id).trim().toUpperCase();
      evidenceKeyMap.set(`${sId}_${ev.distinct_key}`, ev.id);
      if (ev.status === 'VERIFIED') {
        if (!studentVerifiedPcts.has(sId)) {
          studentVerifiedPcts.set(sId, []);
        }
        studentVerifiedPcts.get(sId).push({ id: ev.id, key: ev.distinct_key, pct: parseFloat(ev.percentage || 0) });
      }
    }

    const toInsertEvidence = [];
    const toUpdateEvidence = [];
    const studentNewScores = new Map(); // actualRoll -> { finalMarks, semester, cycleMonth }

    // 3. Fast in-memory parsing & score grouping
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = headerRowIndex + i + 2;

      const rawRoll = row[rollColIdx] !== undefined ? String(row[rollColIdx]).trim() : '';
      const rawName = row[nameColIdx] !== undefined ? String(row[nameColIdx]).trim() : '';
      const rawScore = row[scoreColIdx] !== undefined ? String(row[scoreColIdx]).replace('%', '').trim() : '';

      if (!rawRoll) {
        results.errors.push({ row: rowIndex, name: rawName || 'Unknown', error: 'Roll number is missing' });
        results.failed++;
        continue;
      }

      if (rawScore === '') {
        results.errors.push({ row: rowIndex, rollNo: rawRoll, name: rawName, error: 'Percentage score is missing' });
        results.failed++;
        continue;
      }

      const percentage = parseFloat(rawScore);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        results.errors.push({ row: rowIndex, rollNo: rawRoll, name: rawName, error: `Invalid score "${rawScore}" (must be 0-100)` });
        results.failed++;
        continue;
      }

      const cleanRoll = rawRoll.toUpperCase();
      const profile = profileMap.get(cleanRoll);

      if (!profile) {
        results.errors.push({
          row: rowIndex,
          rollNo: cleanRoll,
          name: rawName,
          error: `Student ${cleanRoll} not found in profiles database`
        });
        results.failed++;
        continue;
      }

      const actualRoll = profile.id_number;
      const actualRollKey = actualRoll.toUpperCase();

      // Aggregate / take the best score if student appears multiple times in same file
      const existingInBatch = toInsertEvidence.find(e => e.student_id.toUpperCase() === actualRollKey) ||
                              toUpdateEvidence.find(e => e.student_id.toUpperCase() === actualRollKey);

      if (existingInBatch) {
        existingInBatch.percentage = Math.max(existingInBatch.percentage, percentage);
      } else {
        const existingEvidenceId = evidenceKeyMap.get(`${actualRollKey}_${distinct_key}`);
        if (existingEvidenceId) {
          toUpdateEvidence.push({
            id: existingEvidenceId,
            student_id: actualRoll,
            percentage,
            semester
          });
          results.updated++;
        } else {
          toInsertEvidence.push({
            student_id: actualRoll,
            percentage,
            semester,
            month: cycleMonth,
            year: currentYear
          });
          results.inserted++;
        }
      }

      // Update in-memory verification list for average calculation
      const finalScoreForStudent = existingInBatch ? existingInBatch.percentage : percentage;
      const pcts = studentVerifiedPcts.get(actualRollKey) || [];
      const existingIdx = pcts.findIndex(p => p.key === distinct_key);
      if (existingIdx >= 0) {
        pcts[existingIdx].pct = finalScoreForStudent;
      } else {
        pcts.push({ key: distinct_key, pct: finalScoreForStudent });
      }
      studentVerifiedPcts.set(actualRollKey, pcts);

      // Compute average score & marks in application code
      const sum = pcts.reduce((acc, p) => acc + p.pct, 0);
      const avgPct = +(sum / pcts.length).toFixed(2);
      let finalMarks = 0;
      if (avgPct >= 80) finalMarks = 20;
      else if (avgPct >= 70) finalMarks = 15;
      else if (avgPct >= 60) finalMarks = 10;
      else if (avgPct >= 50) finalMarks = 5;
      else finalMarks = 0;

      studentNewScores.set(actualRoll, { finalMarks, semester, cycleMonth });
      results.processed++;
    }

    const CHUNK_SIZE = 500;

    // 4. Batch Inserts with ON CONFLICT & Transaction per Chunk
    if (toInsertEvidence.length > 0) {
      for (let i = 0; i < toInsertEvidence.length; i += CHUNK_SIZE) {
        const chunk = toInsertEvidence.slice(i, i + CHUNK_SIZE);
        const transaction = await sequelize.transaction();
        try {
          const values = [];
          const replacements = { uploadedBy, distinct_key };

          chunk.forEach((item, idx) => {
            values.push(`(:st_${idx}, :sem_${idx}, :mon_${idx}, :yr_${idx}, :pct_${idx}, 'Department Batch Assessment', 'VERIFIED', :uploadedBy, :distinct_key, NOW(), NOW(), NOW(), NOW())`);
            replacements[`st_${idx}`] = item.student_id;
            replacements[`sem_${idx}`] = item.semester;
            replacements[`mon_${idx}`] = item.month;
            replacements[`yr_${idx}`] = item.year;
            replacements[`pct_${idx}`] = item.percentage;
          });

          await sequelize.query(
            `INSERT INTO monthly_coding_evidence 
             (student_id, semester, month, year, percentage, platform, status, mentor_id, distinct_key, submitted_at, verified_at, created_at, updated_at)
             VALUES ${values.join(', ')}
             ON CONFLICT (student_id, distinct_key) 
             DO UPDATE SET 
               percentage = EXCLUDED.percentage,
               semester = EXCLUDED.semester,
               status = 'VERIFIED',
               mentor_id = EXCLUDED.mentor_id,
               verified_at = NOW(),
               updated_at = NOW()`,
            { replacements, type: sequelize.QueryTypes.INSERT, transaction }
          );

          await transaction.commit();
        } catch (chunkErr) {
          await transaction.rollback();
          throw chunkErr;
        }
      }
    }

    // 5. Batch Updates with Transaction per Chunk
    if (toUpdateEvidence.length > 0) {
      for (let i = 0; i < toUpdateEvidence.length; i += CHUNK_SIZE) {
        const chunk = toUpdateEvidence.slice(i, i + CHUNK_SIZE);
        const transaction = await sequelize.transaction();
        try {
          const values = [];
          const replacements = { uploadedBy };

          chunk.forEach((item, idx) => {
            values.push(`(:id_${idx}::int, :pct_${idx}::numeric, :sem_${idx}::int)`);
            replacements[`id_${idx}`] = item.id;
            replacements[`pct_${idx}`] = item.percentage;
            replacements[`sem_${idx}`] = item.semester;
          });

          await sequelize.query(
            `UPDATE monthly_coding_evidence AS m
             SET percentage = v.pct,
                 semester = v.sem,
                 status = 'VERIFIED',
                 mentor_id = :uploadedBy,
                 verified_at = NOW(),
                 updated_at = NOW()
             FROM (VALUES ${values.join(', ')}) AS v(id, pct, sem)
             WHERE m.id = v.id`,
            { replacements, type: sequelize.QueryTypes.UPDATE, transaction }
          );

          await transaction.commit();
        } catch (chunkErr) {
          await transaction.rollback();
          throw chunkErr;
        }
      }
    }

    // 6. Bulk Upsert into scores with Transaction per Chunk
    const studentRollList = Array.from(studentNewScores.keys());
    if (studentRollList.length > 0) {
      for (let i = 0; i < studentRollList.length; i += CHUNK_SIZE) {
        const chunk = studentRollList.slice(i, i + CHUNK_SIZE);
        const transaction = await sequelize.transaction();
        try {
          await sequelize.query(
            `DELETE FROM scores WHERE register_number IN (:chunk) AND parameter = 'monthly_coding'`,
            { replacements: { chunk }, type: sequelize.QueryTypes.DELETE, transaction }
          );

          const values = [];
          const replacements = {};
          chunk.forEach((roll, idx) => {
            const sc = studentNewScores.get(roll);
            values.push(`(:roll_${idx}, 'monthly_coding', :m_${idx}, :sem_${idx}, false, :cyc_${idx}, NOW())`);
            replacements[`roll_${idx}`] = roll;
            replacements[`m_${idx}`] = sc.finalMarks;
            replacements[`sem_${idx}`] = sc.semester;
            replacements[`cyc_${idx}`] = sc.cycleMonth;
          });

          await sequelize.query(
            `INSERT INTO scores (register_number, parameter, marks, semester, provisional, rule_version, calculated_at)
             VALUES ${values.join(', ')}`,
            { replacements, type: sequelize.QueryTypes.INSERT, transaction }
          );

          await transaction.commit();
        } catch (chunkErr) {
          await transaction.rollback();
          throw chunkErr;
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[JOB ${jobId}] Bulk processing completed in ${totalTime}s (Processed: ${results.processed}, Failed: ${results.failed})`);

    // Update job status to COMPLETED
    await sequelize.query(
      `UPDATE import_jobs 
       SET status = 'COMPLETED',
           processed_rows = :processed,
           failed_rows = :failed,
           summary = :summary,
           completed_at = NOW()
       WHERE id = :jobId`,
      {
        replacements: {
          jobId,
          processed: results.processed,
          failed: results.failed,
          summary: JSON.stringify({ ...results, totalTimeSeconds: totalTime })
        },
        type: sequelize.QueryTypes.UPDATE
      }
    );

  } catch (jobErr) {
    console.error(`[JOB ${jobId}] Error:`, jobErr);
    await sequelize.query(
      `UPDATE import_jobs 
       SET status = 'FAILED',
           error_log = :errorLog,
           completed_at = NOW()
       WHERE id = :jobId`,
      {
        replacements: {
          jobId,
          errorLog: JSON.stringify({ message: jobErr.message, stack: jobErr.stack })
        },
        type: sequelize.QueryTypes.UPDATE
      }
    );
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
}

/**
 * GET /api/admin/import-jobs/:id
 * Poll background import job status
 */
router.get('/import-jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [job] = await sequelize.query(
      `SELECT id, job_type, status, total_rows, processed_rows, failed_rows, summary, error_log, started_at, completed_at
       FROM import_jobs
       WHERE id = :id`,
      {
        replacements: { id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!job) {
      return res.status(404).json({ success: false, error: 'Import job not found' });
    }

    return res.json({
      success: true,
      job: {
        ...job,
        summary: typeof job.summary === 'string' ? JSON.parse(job.summary) : job.summary,
        error_log: typeof job.error_log === 'string' ? JSON.parse(job.error_log) : job.error_log
      }
    });
  } catch (err) {
    console.error('[IMPORT_JOBS] Status query error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve job status' });
  }
});

/**
 * POST /api/admin/upload-monthly-coding
 * Upload Monthly Coding Assessment Excel file (Async 202 Accepted)
 */
router.post(
  '/upload-monthly-coding',
  upload.single('file'),
  async (req, res, next) => {
    const filePath = req.file ? req.file.path : null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const semester = parseInt(req.body.semester, 10) || 5;
      const month = req.body.month || 'Monthly Assessment';
      const uploadedBy = req.body.uploadedBy || req.user?.id_number || req.user?.name || 'ADMIN';

      // Read Excel structure
      console.log('[UPLOAD] Reading uploaded file:', req.file.originalname);
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!rawData || rawData.length < 2) {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Excel file must have at least 2 rows (header + data)' });
      }

      // Find header row
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const rowStr = rawData[i].map(c => String(c).toLowerCase()).join(' ');
        if (rowStr.includes('roll') || rowStr.includes('reg') || rowStr.includes('student') || rowStr.includes('name') || rowStr.includes('score') || rowStr.includes('percent')) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
      const lowerHeaders = headers.map(h => h.toLowerCase());

      let rollColIdx = lowerHeaders.findIndex(h => h.includes('roll') || h.includes('id_number') || h.includes('student id') || h.includes('id no') || h.includes('register') || h.includes('reg no') || h.includes('reg'));
      let nameColIdx = lowerHeaders.findIndex(h => h.includes('name') || h.includes('student name'));
      let scoreColIdx = lowerHeaders.findIndex(h => h.includes('percent') || h.includes('score') || h.includes('mark') || h.includes('result') || h.includes('%') || h.includes('total') || h.includes('avg'));

      if (rollColIdx === -1) rollColIdx = 1 < headers.length ? 1 : 0;
      if (nameColIdx === -1) nameColIdx = 3 < headers.length ? 3 : (rollColIdx === 0 ? 1 : 0);
      if (scoreColIdx === -1) scoreColIdx = 7 < headers.length ? 7 : (headers.length - 1);

      const rows = rawData.slice(headerRowIndex + 1).filter(r => r.some(cell => cell !== ''));
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Create import_jobs entry
      await sequelize.query(
        `INSERT INTO import_jobs (id, job_type, status, total_rows, processed_rows, failed_rows, started_at)
         VALUES (:jobId, 'monthly_coding_upload', 'PROCESSING', :totalRows, 0, 0, NOW())`,
        {
          replacements: { jobId, totalRows: rows.length },
          type: sequelize.QueryTypes.INSERT
        }
      );

      // Launch async processing in background
      setImmediate(() => {
        processImportJobInBackground({
          jobId,
          rawData,
          headerRowIndex,
          rollColIdx,
          nameColIdx,
          scoreColIdx,
          semester,
          month,
          uploadedBy,
          filePath
        }).catch(err => {
          console.error(`[JOB ${jobId}] Background exception:`, err);
        });
      });

      // Respond immediately with 202 Accepted
      return res.status(202).json({
        success: true,
        jobId,
        totalRows: rows.length,
        message: 'Monthly coding assessment upload accepted and processing in background.'
      });

    } catch (error) {
      console.error('[UPLOAD] Error:', error.message);
      if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
      res.status(500).json({
        error: 'Failed to initiate monthly coding assessment upload',
        message: error.message
      });
    }
  }
);

/**
 * Helper function for Readiness Tiers
 */
function calculateTier(totalScore) {
  const score = parseFloat(totalScore) || 0;
  if (score >= 200) {
    return { level: 'Elite', title: 'Elite Tier', badgeClass: 'tier-elite', color: '#10b981' };
  } else if (score >= 160) {
    return { level: 'Level 3', title: 'Level 3 - High Tier Product', badgeClass: 'tier-l3', color: '#8b5cf6' };
  } else if (score >= 120) {
    return { level: 'Level 2', title: 'Level 2 - Placement Ready', badgeClass: 'tier-l2', color: '#3b82f6' };
  } else if (score >= 80) {
    return { level: 'Level 1', title: 'Level 1 - Foundation Ready', badgeClass: 'tier-l1', color: '#f59e0b' };
  } else {
    return { level: 'Not Eligible', title: 'Not Eligible', badgeClass: 'tier-none', color: '#ef4444' };
  }
}

/**
 * Helper to determine student year and batch
 */
function getStudentYearAndBatch(idNumber, registerNumber) {
  const id = String(idNumber || '').toLowerCase().trim();
  const reg = String(registerNumber || '').toLowerCase().trim();

  if (id.startsWith('25') || reg.includes('25') || id.includes('25')) {
    return { year: 2, batch: '2029', label: '2nd Year (2029 Batch)', shortLabel: '2nd Year (2029)', badgeClass: 'year-2' };
  }
  if (id.startsWith('24') || reg.includes('24') || id.includes('24')) {
    return { year: 3, batch: '2028', label: '3rd Year (2028 Batch)', shortLabel: '3rd Year (2028)', badgeClass: 'year-3' };
  }
  return { year: 3, batch: '2028', label: '3rd Year (2028 Batch)', shortLabel: '3rd Year (2028)', badgeClass: 'year-3' };
}

/**
 * GET /api/admin/student-scores
 * Get all students with their 12-parameter scores and computed readiness level
 */
router.get('/student-scores', async (req, res) => {
  try {
    const { search, department, tier, mentor_id, year, batch, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 1. Fetch all students
    let studentQuery = `
      SELECT 
        p.id_number,
        p.register_number,
        p.name,
        p.email,
        p.department,
        p.college,
        p.assigned_mentor_id,
        m.name AS assigned_mentor_name
      FROM profiles p
      LEFT JOIN profiles m ON p.assigned_mentor_id = m.id_number
      WHERE p.role = 'student'
    `;
    const params = {};

    if (department && department !== 'ALL') {
      studentQuery += ` AND p.department = :department`;
      params.department = department;
    }

    if (mentor_id && mentor_id !== 'ALL') {
      if (mentor_id === 'UNASSIGNED') {
        studentQuery += ` AND (p.assigned_mentor_id IS NULL OR p.assigned_mentor_id = '')`;
      } else {
        studentQuery += ` AND p.assigned_mentor_id = :mentor_id`;
        params.mentor_id = mentor_id;
      }
    }

    // Year / Batch filtering
    if (year === '2' || year === '2nd' || batch === '2029') {
      studentQuery += ` AND (LOWER(p.id_number) LIKE '25%' OR p.register_number LIKE '%25%')`;
    } else if (year === '3' || year === '3rd' || batch === '2028') {
      studentQuery += ` AND (LOWER(p.id_number) LIKE '24%' OR p.register_number LIKE '%24%')`;
    }

    studentQuery += ` ORDER BY p.id_number ASC`;

    const allStudents = await sequelize.query(studentQuery, {
      replacements: params,
      type: sequelize.QueryTypes.SELECT
    });

    if (allStudents.length === 0) {
      return res.json({
        success: true,
        stats: { total: 0, second_year_count: 0, third_year_count: 0, avg_score: 0, elite: 0, l3: 0, l2: 0, l1: 0, not_eligible: 0, unassigned: 0 },
        pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, total_pages: 0 },
        students: []
      });
    }

    // 2. Fetch all scores for these students
    const studentIds = allStudents.map(s => s.id_number);
    const allScores = await sequelize.query(`
      SELECT register_number, parameter, marks
      FROM scores
      WHERE register_number IN (:studentIds)
    `, {
      replacements: { studentIds },
      type: sequelize.QueryTypes.SELECT
    });

    const scoreMap = {};
    allScores.forEach(s => {
      if (!scoreMap[s.register_number]) scoreMap[s.register_number] = {};
      scoreMap[s.register_number][s.parameter] = parseFloat(s.marks) || 0;
    });

    // 3. Assemble full student profile objects & tier statistics
    let stats = {
      total: allStudents.length,
      second_year_count: 0,
      third_year_count: 0,
      total_score_sum: 0,
      elite: 0,
      l3: 0,
      l2: 0,
      l1: 0,
      not_eligible: 0,
      unassigned: 0
    };

    let processed = allStudents.map(st => {
      const sMap = scoreMap[st.id_number] || {};
      const totalScore = Object.values(sMap).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
      const roundedTotal = Math.round(totalScore * 10) / 10;
      const readinessTier = calculateTier(roundedTotal);
      const yearInfo = getStudentYearAndBatch(st.id_number, st.register_number);

      stats.total_score_sum += roundedTotal;
      if (yearInfo.year === 2) stats.second_year_count++;
      else stats.third_year_count++;

      if (readinessTier.level === 'Elite') stats.elite++;
      else if (readinessTier.level === 'Level 3') stats.l3++;
      else if (readinessTier.level === 'Level 2') stats.l2++;
      else if (readinessTier.level === 'Level 1') stats.l1++;
      else stats.not_eligible++;

      if (!st.assigned_mentor_id) stats.unassigned++;

      return {
        id_number: st.id_number,
        roll_number: st.id_number,
        register_number: st.register_number,
        name: st.name,
        email: st.email,
        department: st.department,
        college: st.college,
        year: yearInfo.year,
        batch: yearInfo.batch,
        batch_label: yearInfo.label,
        short_batch_label: yearInfo.shortLabel,
        batch_badge_class: yearInfo.badgeClass,
        assigned_mentor_id: st.assigned_mentor_id,
        assigned_mentor_name: st.assigned_mentor_name || 'Not Assigned',
        scores: {
          hundred_days: sMap.hundred_days || 0,
          language: sMap.language || 0,
          gate: sMap.gate || 0,
          competition: sMap.competition || 0,
          internship: sMap.internship || 0,
          certificate: sMap.certificate || 0,
          aptitude: sMap.aptitude || 0,
          coding_problems: sMap.coding_problems || 0,
          cp_rating: sMap.cp_rating || 0,
          opensource: sMap.opensource || 0,
          monthly_coding: sMap.monthly_coding || 0,
          project: sMap.project || 0
        },
        total_score: roundedTotal,
        max_possible: 250,
        completed_parameters: Object.keys(sMap).length,
        readiness_tier: readinessTier
      };
    });

    // 4. Client Search & Tier Filtering
    if (search) {
      const q = search.toLowerCase();
      processed = processed.filter(
        s => s.name.toLowerCase().includes(q) || s.id_number.toLowerCase().includes(q) || s.register_number.toLowerCase().includes(q)
      );
    }

    if (tier && tier !== 'ALL') {
      processed = processed.filter(s => s.readiness_tier.level === tier);
    }

    const filteredTotal = processed.length;
    const paginatedStudents = processed.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      stats: {
        total: stats.total,
        second_year_count: stats.second_year_count,
        third_year_count: stats.third_year_count,
        avg_score: stats.total > 0 ? parseFloat((stats.total_score_sum / stats.total).toFixed(1)) : 0,
        elite: stats.elite,
        l3: stats.l3,
        l2: stats.l2,
        l1: stats.l1,
        not_eligible: stats.not_eligible,
        unassigned: stats.unassigned
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredTotal,
        total_pages: Math.ceil(filteredTotal / parseInt(limit))
      },
      students: paginatedStudents
    });
  } catch (error) {
    console.error('[ADMIN STUDENT SCORES] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/mentors
 * Get mentors filtered by year (2nd Year / 3rd Year) with their mentee counts
 */
router.get('/mentors', async (req, res) => {
  try {
    const { year } = req.query;
    let yearFilter = '';
    const replacements = {};

    if (year === '2' || year === '2nd') {
      yearFilter = `WHERE (m.mentor_year = 2 OR m.id_number LIKE '%2ND%')`;
    } else if (year === '3' || year === '3rd') {
      yearFilter = `WHERE (m.mentor_year = 3 OR m.id_number LIKE '%3RD%')`;
    } else {
      // Exclude legacy duplicate mentors with 0 mentees if year-specific exist
      yearFilter = `WHERE (m.mentor_year IS NOT NULL OR m.id_number LIKE '%2ND%' OR m.id_number LIKE '%3RD%')`;
    }

    const mentors = await sequelize.query(`
      SELECT 
        m.id_number,
        m.name,
        m.email,
        m.department,
        m.mentor_year,
        COUNT(s.id_number) as assigned_count,
        COUNT(CASE WHEN LOWER(s.id_number) LIKE '25%' OR s.register_number LIKE '%25%' THEN 1 END) as second_year_count,
        COUNT(CASE WHEN LOWER(s.id_number) LIKE '24%' OR s.register_number LIKE '%24%' THEN 1 END) as third_year_count
      FROM profiles m
      LEFT JOIN profiles s ON s.assigned_mentor_id = m.id_number AND s.role = 'student'
      ${yearFilter} AND m.role = 'mentor'
      GROUP BY m.id_number, m.name, m.email, m.department, m.mentor_year
      ORDER BY m.mentor_year ASC, m.department ASC, m.name ASC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      year_filter: year || 'ALL',
      mentors: mentors.map(m => ({
        ...m,
        mentor_year: m.mentor_year || (m.id_number.includes('2ND') ? 2 : 3),
        assigned_count: parseInt(m.assigned_count) || 0,
        second_year_count: parseInt(m.second_year_count) || 0,
        third_year_count: parseInt(m.third_year_count) || 0
      }))
    });
  } catch (error) {
    console.error('[ADMIN MENTORS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/assign-mentor
 * Assign a batch of students to a mentor
 * Body: { student_ids: string[], mentor_id: string }
 */
router.post('/assign-mentor', async (req, res) => {
  try {
    const { student_ids, mentor_id } = req.body;

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'student_ids array is required' });
    }

    if (!mentor_id) {
      return res.status(400).json({ success: false, error: 'mentor_id is required' });
    }

    // Verify mentor exists
    const [mentor] = await sequelize.query(`
      SELECT id_number, name, department, mentor_year FROM profiles WHERE id_number = :mentor_id AND role = 'mentor'
    `, {
      replacements: { mentor_id },
      type: sequelize.QueryTypes.SELECT
    });

    if (!mentor) {
      return res.status(404).json({ success: false, error: 'Mentor not found' });
    }

    await sequelize.query(`
      UPDATE profiles
      SET assigned_mentor_id = :mentor_id,
          updated_at = NOW()
      WHERE id_number IN (:student_ids) AND role = 'student'
    `, {
      replacements: { mentor_id, student_ids }
    });

    res.json({
      success: true,
      message: `Assigned ${student_ids.length} student(s) to mentor ${mentor.name} (${mentor_id})`,
      assigned_count: student_ids.length,
      mentor: mentor
    });
  } catch (error) {
    console.error('[ADMIN ASSIGN MENTOR] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/auto-assign-departments
 * Auto-assign students to mentors based on their department & academic year
 * Body: { year?: 2 | 3 | 'ALL' }
 */
router.post('/auto-assign-departments', async (req, res) => {
  try {
    const targetYear = req.body.year;

    // 1. Process 3rd Year (Batch 2028) if requested or ALL
    if (!targetYear || targetYear === '3' || targetYear === 3 || targetYear === 'ALL') {
      const mentors3rd = await sequelize.query(`
        SELECT id_number, department, name FROM profiles WHERE role = 'mentor' AND (mentor_year = 3 OR id_number LIKE '%3RD%')
      `, { type: sequelize.QueryTypes.SELECT });

      for (const m of mentors3rd) {
        let deptCondition = `department = :dept`;
        if (m.department === 'CSE') {
          deptCondition = `(department = 'CSE' OR department = 'M.Tech CSE')`;
        } else if (m.department === 'AI & ML') {
          deptCondition = `(department = 'AI & ML' OR department = 'CSE (AI & ML)')`;
        }

        await sequelize.query(`
          UPDATE profiles
          SET assigned_mentor_id = :mentorId
          WHERE role = 'student'
            AND (LOWER(id_number) LIKE '24%' OR register_number LIKE '%24%')
            AND ${deptCondition}
            AND (assigned_mentor_id IS NULL OR assigned_mentor_id = '')
        `, {
          replacements: { mentorId: m.id_number, dept: m.department }
        });
      }
    }

    // 2. Process 2nd Year (Batch 2029) if requested or ALL
    if (!targetYear || targetYear === '2' || targetYear === 2 || targetYear === 'ALL') {
      const mentors2nd = await sequelize.query(`
        SELECT id_number, department, name FROM profiles WHERE role = 'mentor' AND (mentor_year = 2 OR id_number LIKE '%2ND%')
      `, { type: sequelize.QueryTypes.SELECT });

      for (const m of mentors2nd) {
        let deptCondition = `department = :dept`;
        if (m.department === 'CSE') {
          deptCondition = `(department = 'CSE' OR department = 'M.Tech CSE')`;
        } else if (m.department === 'AI & ML') {
          deptCondition = `(department = 'AI & ML' OR department = 'CSE (AI & ML)')`;
        }

        await sequelize.query(`
          UPDATE profiles
          SET assigned_mentor_id = :mentorId
          WHERE role = 'student'
            AND (LOWER(id_number) LIKE '25%' OR register_number LIKE '%25%')
            AND ${deptCondition}
            AND (assigned_mentor_id IS NULL OR assigned_mentor_id = '')
        `, {
          replacements: { mentorId: m.id_number, dept: m.department }
        });
      }
    }

    res.json({
      success: true,
      message: `Auto-assigned students to their respective 2nd/3rd year department mentors`
    });
  } catch (error) {
    console.error('[ADMIN AUTO ASSIGN] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


