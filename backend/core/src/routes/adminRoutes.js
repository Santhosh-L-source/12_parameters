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

function inferDepartment(roll) {
  const r = String(roll || '').toUpperCase();
  if (r.includes('CS') || r.includes('CSE')) return 'CSE';
  if (r.includes('IT')) return 'IT';
  if (r.includes('AD') || r.includes('AI') || r.includes('DS')) return 'AI & DS';
  if (r.includes('EC') || r.includes('ECE')) return 'ECE';
  if (r.includes('EE') || r.includes('EEE')) return 'EEE';
  if (r.includes('ME') || r.includes('MECH')) return 'MECH';
  if (r.includes('CE') || r.includes('CIVIL')) return 'CIVIL';
  if (r.includes('CB') || r.includes('CSBS')) return 'CSBS';
  return 'CSE';
}

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
  regColIdx = -1,
  deptColIdx = -1,
  emailColIdx = -1,
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

    // 1. One bulk lookup for all roll numbers from students table
    let matchingProfiles = [];
    if (allRollsInFile.length > 0) {
      matchingProfiles = await sequelize.query(
        `SELECT roll_number, register_number, name, department, batch, year_of_study 
         FROM students 
         WHERE UPPER(TRIM(roll_number)) = ANY(ARRAY[:allRollsInFile]::text[]) 
            OR UPPER(TRIM(COALESCE(register_number, ''))) = ANY(ARRAY[:allRollsInFile]::text[])`,
        {
          replacements: { allRollsInFile },
          type: sequelize.QueryTypes.SELECT
        }
      );
    }

    const profileMap = new Map();
    for (const p of matchingProfiles) {
      if (p.roll_number) profileMap.set(String(p.roll_number).trim().toUpperCase(), p);
      if (p.register_number) profileMap.set(String(p.register_number).trim().toUpperCase(), p);
    }

    // Auto-create/register any students found in the file that are not yet in the DB
    const newStudentsToCreate = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawRoll = row[rollColIdx] !== undefined ? String(row[rollColIdx]).trim() : '';
      if (!rawRoll) continue;
      const cleanRoll = rawRoll.toUpperCase();

      if (!profileMap.has(cleanRoll)) {
        const rawName = nameColIdx !== -1 && row[nameColIdx] !== undefined ? String(row[nameColIdx]).trim() : 'Student';
        const rawReg = regColIdx !== -1 && row[regColIdx] !== undefined ? String(row[regColIdx]).trim() : '';
        const rawDept = deptColIdx !== -1 && row[deptColIdx] !== undefined ? String(row[deptColIdx]).trim().toUpperCase() : '';
        const yr = cleanRoll.startsWith('25') ? 2 : (cleanRoll.startsWith('24') ? 3 : (parseInt(semester, 10) >= 5 ? 3 : 2));
        const batch = yr === 2 ? '2029' : '2028';
        const dept = rawDept || inferDepartment(cleanRoll);
        const email = (emailColIdx !== -1 && row[emailColIdx] ? String(row[emailColIdx]).trim().toLowerCase() : null) || `${cleanRoll.toLowerCase()}@hope.edu`;
        const regNo = rawReg || cleanRoll;

        const studentObj = {
          roll_number: cleanRoll,
          register_number: regNo,
          name: rawName || 'Student',
          department: dept,
          batch,
          year_of_study: yr,
          email
        };

        newStudentsToCreate.push(studentObj);
        profileMap.set(cleanRoll, studentObj);
        if (regNo) profileMap.set(regNo.toUpperCase(), studentObj);
      }
    }

    const CHUNK_SIZE = 500;

    // Batch insert newly discovered students into students and profiles
    if (newStudentsToCreate.length > 0) {
      console.log(`[JOB ${jobId}] Auto-registering ${newStudentsToCreate.length} new students into database...`);
      for (let i = 0; i < newStudentsToCreate.length; i += CHUNK_SIZE) {
        const chunk = newStudentsToCreate.slice(i, i + CHUNK_SIZE);
        const studentValues = [];
        const studentReplacements = {};
        const profileValues = [];
        const profileReplacements = {};

        chunk.forEach((st, idx) => {
          studentValues.push(`(:roll_${idx}, :reg_${idx}, :name_${idx}, :email_${idx}, :dept_${idx}, :batch_${idx}, :yr_${idx}, 'student', :pass_${idx})`);
          studentReplacements[`roll_${idx}`] = st.roll_number;
          studentReplacements[`reg_${idx}`] = st.register_number;
          studentReplacements[`name_${idx}`] = st.name;
          studentReplacements[`email_${idx}`] = st.email;
          studentReplacements[`dept_${idx}`] = st.department;
          studentReplacements[`batch_${idx}`] = st.batch;
          studentReplacements[`yr_${idx}`] = st.year_of_study;
          studentReplacements[`pass_${idx}`] = st.register_number || st.roll_number;

          profileValues.push(`(:p_roll_${idx}, :p_name_${idx}, :p_dept_${idx}, :p_batch_${idx}, 0, 0, 'NOT_ELIGIBLE', 'Active')`);
          profileReplacements[`p_roll_${idx}`] = st.roll_number;
          profileReplacements[`p_name_${idx}`] = st.name;
          profileReplacements[`p_dept_${idx}`] = st.department;
          profileReplacements[`p_batch_${idx}`] = st.batch;
        });

        try {
          await sequelize.query(
            `INSERT INTO students (roll_number, register_number, name, email, department, batch, year_of_study, role, password_hash)
             VALUES ${studentValues.join(', ')}
             ON CONFLICT (roll_number) DO UPDATE SET
               name = EXCLUDED.name,
               department = EXCLUDED.department,
               batch = EXCLUDED.batch,
               year_of_study = EXCLUDED.year_of_study`,
            { replacements: studentReplacements, type: sequelize.QueryTypes.INSERT }
          );

          await sequelize.query(
            `INSERT INTO profiles (roll_number, name, department, batch, total_score, coding_score, level, readiness_status)
             VALUES ${profileValues.join(', ')}
             ON CONFLICT (roll_number) DO UPDATE SET
               name = EXCLUDED.name,
               department = EXCLUDED.department,
               batch = EXCLUDED.batch`,
            { replacements: profileReplacements, type: sequelize.QueryTypes.INSERT }
          );
        } catch (createErr) {
          console.warn('[JOB] Warning creating students chunk:', createErr.message);
        }
      }
    }

    // 2. One bulk fetch of existing evidence for all matched students
    const allKnownRolls = Array.from(new Set(Array.from(profileMap.values()).map(p => p.roll_number)));
    let existingEvidence = [];
    if (allKnownRolls.length > 0) {
      existingEvidence = await sequelize.query(
        `SELECT id, roll_number, contest_name, percentile, score, status 
         FROM monthly_coding_evidence 
         WHERE roll_number = ANY(ARRAY[:allKnownRolls]::text[])`,
        {
          replacements: { allKnownRolls },
          type: sequelize.QueryTypes.SELECT
        }
      );
    }

    const evidenceKeyMap = new Map(); // roll_number + '_' + contest_name -> id
    const studentVerifiedPcts = new Map(); // roll_number -> array of { key, pct }

    for (const ev of existingEvidence) {
      const rNo = String(ev.roll_number).trim().toUpperCase();
      const cName = String(ev.contest_name || '').trim().toUpperCase();
      evidenceKeyMap.set(`${rNo}_${cName}`, ev.id);
      if (ev.status === 'VERIFIED') {
        if (!studentVerifiedPcts.has(rNo)) {
          studentVerifiedPcts.set(rNo, []);
        }
        studentVerifiedPcts.get(rNo).push({ id: ev.id, key: cName, pct: parseFloat(ev.percentile || ev.score || 0) });
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
      const rawName = nameColIdx !== -1 && row[nameColIdx] !== undefined ? String(row[nameColIdx]).trim() : '';
      const rawScore = scoreColIdx !== -1 && row[scoreColIdx] !== undefined ? String(row[scoreColIdx]).replace('%', '').trim() : '';

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
          error: `Student ${cleanRoll} not found in students database`
        });
        results.failed++;
        continue;
      }

      const actualRoll = profile.roll_number;
      const actualRollKey = actualRoll.toUpperCase();
      const contestKey = cycleMonth.toUpperCase();

      // Aggregate / take the best score if student appears multiple times in same file
      const existingInBatch = toInsertEvidence.find(e => e.roll_number.toUpperCase() === actualRollKey) ||
                              toUpdateEvidence.find(e => e.roll_number.toUpperCase() === actualRollKey);

      if (existingInBatch) {
        existingInBatch.percentile = Math.max(existingInBatch.percentile, percentage);
        existingInBatch.score = existingInBatch.percentile;
      } else {
        const existingEvidenceId = evidenceKeyMap.get(`${actualRollKey}_${contestKey}`);
        if (existingEvidenceId) {
          toUpdateEvidence.push({
            id: existingEvidenceId,
            roll_number: actualRoll,
            percentile: percentage,
            score: percentage,
            semester
          });
          results.updated++;
        } else {
          toInsertEvidence.push({
            roll_number: actualRoll,
            contest_name: cycleMonth,
            percentile: percentage,
            score: percentage,
            semester
          });
          results.inserted++;
        }
      }

      // Update in-memory verification list for average calculation
      const finalScoreForStudent = existingInBatch ? existingInBatch.percentile : percentage;
      const pcts = studentVerifiedPcts.get(actualRollKey) || [];
      const existingIdx = pcts.findIndex(p => p.key === contestKey);
      if (existingIdx >= 0) {
        pcts[existingIdx].pct = finalScoreForStudent;
      } else {
        pcts.push({ key: contestKey, pct: finalScoreForStudent });
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

    // 4. Batch Inserts into monthly_coding_evidence
    if (toInsertEvidence.length > 0) {
      for (let i = 0; i < toInsertEvidence.length; i += CHUNK_SIZE) {
        const chunk = toInsertEvidence.slice(i, i + CHUNK_SIZE);
        const transaction = await sequelize.transaction();
        try {
          const values = [];
          const replacements = {};

          chunk.forEach((item, idx) => {
            values.push(`(gen_random_uuid(), :st_${idx}, :con_${idx}, :pct_${idx}, :sc_${idx}, :sem_${idx}, 'VERIFIED', NOW())`);
            replacements[`st_${idx}`] = item.roll_number;
            replacements[`con_${idx}`] = item.contest_name;
            replacements[`pct_${idx}`] = item.percentile;
            replacements[`sc_${idx}`] = item.score;
            replacements[`sem_${idx}`] = item.semester;
          });

          await sequelize.query(
            `INSERT INTO monthly_coding_evidence 
             (id, roll_number, contest_name, percentile, score, semester, status, assessed_at)
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

    // 5. Batch Updates for monthly_coding_evidence
    if (toUpdateEvidence.length > 0) {
      for (let i = 0; i < toUpdateEvidence.length; i += CHUNK_SIZE) {
        const chunk = toUpdateEvidence.slice(i, i + CHUNK_SIZE);
        const transaction = await sequelize.transaction();
        try {
          const values = [];
          const replacements = {};

          chunk.forEach((item, idx) => {
            values.push(`(:id_${idx}::uuid, :pct_${idx}::numeric, :sc_${idx}::numeric, :sem_${idx}::int)`);
            replacements[`id_${idx}`] = item.id;
            replacements[`pct_${idx}`] = item.percentile;
            replacements[`sc_${idx}`] = item.score;
            replacements[`sem_${idx}`] = item.semester;
          });

          await sequelize.query(
            `UPDATE monthly_coding_evidence AS m
             SET percentile = v.pct,
                 score = v.sc,
                 semester = v.sem,
                 status = 'VERIFIED',
                 assessed_at = NOW()
             FROM (VALUES ${values.join(', ')}) AS v(id, pct, sc, sem)
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
          const values = [];
          const replacements = {};
          chunk.forEach((roll, idx) => {
            const sc = studentNewScores.get(roll);
            values.push(`(:roll_${idx}, 'monthly_coding', :m_${idx}, :sem_${idx}, false, NOW())`);
            replacements[`roll_${idx}`] = roll;
            replacements[`m_${idx}`] = sc.finalMarks;
            replacements[`sem_${idx}`] = sc.semester;
          });

          await sequelize.query(
            `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
             VALUES ${values.join(', ')}
             ON CONFLICT (roll_number, parameter_id, semester)
             DO UPDATE SET 
               marks = EXCLUDED.marks,
               provisional = false,
               calculated_at = NOW()`,
            { replacements, type: sequelize.QueryTypes.INSERT, transaction }
          );

          await transaction.commit();
        } catch (chunkErr) {
          await transaction.rollback();
          throw chunkErr;
        }
      }

      // 7. Update profiles summary scores
      try {
        await sequelize.query(
          `UPDATE profiles p
           SET total_score = COALESCE((
                 SELECT SUM(s.marks) FROM scores s WHERE s.roll_number = p.roll_number
               ), 0),
               coding_score = COALESCE((
                 SELECT SUM(s.marks) FROM scores s 
                 WHERE s.roll_number = p.roll_number 
                   AND s.parameter_id IN ('coding_problems', 'cp_rating', 'monthly_coding', '100_days_coding')
               ), 0),
               updated_at = NOW()
           WHERE p.roll_number IN (:studentRollList)`,
          { replacements: { studentRollList } }
        );
      } catch (profErr) {
        console.warn('[JOB] Profile score update warning:', profErr.message);
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

      let rollColIdx = lowerHeaders.findIndex(h => h.includes('roll') || h.includes('id_number') || h.includes('student id') || h.includes('id no'));
      let regColIdx = lowerHeaders.findIndex(h => (h.includes('reg') || h.includes('register')) && !h.includes('roll'));
      let nameColIdx = lowerHeaders.findIndex(h => h.includes('name') || h.includes('student name'));
      let deptColIdx = lowerHeaders.findIndex(h => h.includes('dept') || h.includes('branch') || h.includes('department'));
      let emailColIdx = lowerHeaders.findIndex(h => h.includes('mail') || h.includes('email'));
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
          regColIdx,
          deptColIdx,
          emailColIdx,
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
function getStudentYearAndBatch(idNumber, registerNumber, yearOfStudy, batch) {
  if (yearOfStudy === 2 || batch === '2029') {
    return { year: 2, batch: '2029', label: '2nd Year (2029 Batch)', shortLabel: '2nd Year (2029)', badgeClass: 'year-2' };
  }
  if (yearOfStudy === 3 || batch === '2028') {
    return { year: 3, batch: '2028', label: '3rd Year (2028 Batch)', shortLabel: '3rd Year (2028)', badgeClass: 'year-3' };
  }

  const id = String(idNumber || '').toUpperCase().trim();
  const reg = String(registerNumber || '').toUpperCase().trim();

  // 1. Check direct prefix of Roll Number (id_number)
  if (id.startsWith('25') || reg.startsWith('312325') || reg.startsWith('312425')) {
    return { year: 2, batch: '2029', label: '2nd Year (2029 Batch)', shortLabel: '2nd Year (2029)', badgeClass: 'year-2' };
  }
  if (id.startsWith('24') || reg.startsWith('312324') || reg.startsWith('312424')) {
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
        s.roll_number as id_number,
        s.roll_number,
        s.register_number,
        s.name,
        s.email,
        s.department,
        s.batch,
        s.year_of_study,
        s.mentor_roll_number as assigned_mentor_id,
        m.name AS assigned_mentor_name
      FROM students s
      LEFT JOIN mentors m ON s.mentor_roll_number = m.roll_number
      WHERE 1=1
    `;
    const params = {};

    if (department && department !== 'ALL') {
      studentQuery += ` AND s.department = :department`;
      params.department = department;
    }

    if (mentor_id && mentor_id !== 'ALL') {
      if (mentor_id === 'UNASSIGNED') {
        studentQuery += ` AND (s.mentor_roll_number IS NULL OR s.mentor_roll_number = '')`;
      } else {
        studentQuery += ` AND s.mentor_roll_number = :mentor_id`;
        params.mentor_id = mentor_id;
      }
    }

    // Year / Batch filtering
    if (year === '2' || year === '2nd' || batch === '2029' || parseInt(year) === 2) {
      studentQuery += ` AND (s.year_of_study = 2 OR s.batch = '2029' OR UPPER(TRIM(s.roll_number)) LIKE '25%' OR s.register_number LIKE '312425%' OR s.register_number LIKE '312325%')`;
    } else if (year === '3' || year === '3rd' || batch === '2028' || parseInt(year) === 3) {
      studentQuery += ` AND (s.year_of_study = 3 OR s.batch = '2028' OR UPPER(TRIM(s.roll_number)) LIKE '24%' OR s.register_number LIKE '312424%' OR s.register_number LIKE '312324%')`;
    }

    studentQuery += ` ORDER BY s.roll_number ASC`;

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
    const studentIds = allStudents.map(s => s.roll_number);
    const allScores = await sequelize.query(`
      SELECT roll_number as register_number, parameter_id as parameter, marks
      FROM scores
      WHERE roll_number IN (:studentIds)
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
      const sMap = scoreMap[st.roll_number] || {};
      const totalScore = Object.values(sMap).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
      const roundedTotal = Math.round(totalScore * 10) / 10;
      const readinessTier = calculateTier(roundedTotal);
      const yearInfo = getStudentYearAndBatch(st.roll_number, st.register_number, st.year_of_study, st.batch);

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
        id_number: st.roll_number,
        roll_number: st.roll_number,
        register_number: st.register_number,
        name: st.name,
        email: st.email,
        department: st.department,
        college: ((st.register_number && st.register_number.startsWith('3124')) || (st.roll_number && st.roll_number.startsWith('3124')))
          ? "St. Joseph's Institute of Technology"
          : "St. Joseph's College of Engineering",
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
        s => s.name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q) || (s.register_number && s.register_number.toLowerCase().includes(q))
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

    const mentors = await sequelize.query(`
      SELECT 
        m.roll_number as id_number,
        m.roll_number,
        m.name,
        m.email,
        m.department,
        COUNT(s.roll_number) as assigned_count,
        COUNT(CASE WHEN s.year_of_study = 2 OR s.batch = '2029' OR UPPER(TRIM(s.roll_number)) LIKE '25%' OR s.register_number LIKE '312425%' OR s.register_number LIKE '312325%' THEN 1 END) as second_year_count,
        COUNT(CASE WHEN s.year_of_study = 3 OR s.batch = '2028' OR UPPER(TRIM(s.roll_number)) LIKE '24%' OR s.register_number LIKE '312424%' OR s.register_number LIKE '312324%' THEN 1 END) as third_year_count
      FROM mentors m
      LEFT JOIN students s ON s.mentor_roll_number = m.roll_number
      GROUP BY m.roll_number, m.name, m.email, m.department
      ORDER BY m.department ASC, m.name ASC
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    const [totals] = await sequelize.query(`
      SELECT 
        COUNT(CASE WHEN year_of_study = 3 OR batch = '2028' OR UPPER(TRIM(roll_number)) LIKE '24%' OR register_number LIKE '312424%' OR register_number LIKE '312324%' THEN 1 END) as total_3rd_year,
        COUNT(CASE WHEN year_of_study = 2 OR batch = '2029' OR UPPER(TRIM(roll_number)) LIKE '25%' OR register_number LIKE '312425%' OR register_number LIKE '312325%' THEN 1 END) as total_2nd_year,
        COUNT(*) as total_students
      FROM students
    `, { type: sequelize.QueryTypes.SELECT });

    const total3rdYear = parseInt(totals?.total_3rd_year) || 0;
    const total2ndYear = parseInt(totals?.total_2nd_year) || 0;
    const totalStudents = parseInt(totals?.total_students) || 0;

    res.json({
      success: true,
      year_filter: year || 'ALL',
      totals: {
        total_3rd_year: total3rdYear,
        total_2nd_year: total2ndYear,
        total_students: totalStudents
      },
      mentors: mentors.map(m => {
        const secCount = parseInt(m.second_year_count) || 0;
        const thrdCount = parseInt(m.third_year_count) || 0;
        const allCount = parseInt(m.assigned_count) || 0;
        const targetCount = (year === '2' || parseInt(year) === 2) 
          ? secCount 
          : ((year === '3' || parseInt(year) === 3) ? thrdCount : allCount);

        return {
          ...m,
          mentor_year: year === '2' ? 2 : 3,
          assigned_count: targetCount,
          second_year_count: secCount,
          third_year_count: thrdCount,
          total_assigned: allCount
        };
      })
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
      SELECT roll_number, name, department FROM mentors WHERE roll_number = :mentor_id
    `, {
      replacements: { mentor_id },
      type: sequelize.QueryTypes.SELECT
    });

    if (!mentor) {
      return res.status(404).json({ success: false, error: 'Mentor not found' });
    }

    await sequelize.query(`
      UPDATE students
      SET mentor_roll_number = :mentor_id,
          updated_at = NOW()
      WHERE roll_number IN (:student_ids)
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

    const allMentors = await sequelize.query(`
      SELECT roll_number, department, name FROM mentors WHERE department IS NOT NULL AND department != ''
    `, { type: sequelize.QueryTypes.SELECT });

    let totalAssigned = 0;

    for (const m of allMentors) {
      let deptCondition = `s.department = :dept`;
      if (m.department === 'CSE') {
        deptCondition = `(s.department = 'CSE' OR s.department = 'M.Tech CSE')`;
      } else if (m.department === 'AI & ML') {
        deptCondition = `(s.department = 'AI & ML' OR s.department = 'CSE (AI & ML)')`;
      } else if (m.department === 'AI & DS') {
        deptCondition = `(s.department = 'AI & DS' OR s.department = 'AIDS')`;
      }

      let yearCondition = '1=1';
      if (targetYear === 3 || targetYear === '3') {
        yearCondition = `(s.year_of_study = 3 OR s.batch = '2028' OR UPPER(TRIM(s.roll_number)) LIKE '24%' OR s.register_number LIKE '312424%' OR s.register_number LIKE '312324%')`;
      } else if (targetYear === 2 || targetYear === '2') {
        yearCondition = `(s.year_of_study = 2 OR s.batch = '2029' OR UPPER(TRIM(s.roll_number)) LIKE '25%' OR s.register_number LIKE '312425%' OR s.register_number LIKE '312325%')`;
      }

      const [updated] = await sequelize.query(`
        UPDATE students s
        SET mentor_roll_number = :mentorId,
            updated_at = NOW()
        WHERE ${yearCondition}
          AND ${deptCondition}
      `, {
        replacements: { mentorId: m.roll_number, dept: m.department }
      });

      totalAssigned += (updated?.length || 0);
    }

    res.json({
      success: true,
      message: `Auto-assigned students to their respective department mentors for ${targetYear ? (targetYear === 2 ? '2nd Year (2029 Batch)' : '3rd Year (2028 Batch)') : 'all cohorts'}`
    });
  } catch (error) {
    console.error('[ADMIN AUTO ASSIGN] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/export/scores
 * Export all students' 12-parameter pivoted scores as formatted Excel (.xlsx)
 * Query params: format=xlsx, semester=3|5|all, department=CSE|..., search=...
 */
router.get('/export/scores', async (req, res) => {
  try {
    const { semester, department, search } = req.query;
    const { generateScoresWorkbook } = require('../services/scoreExportService');

    const { workbook, totalRows } = await generateScoresWorkbook({
      semester: semester && semester !== 'all' ? semester : null,
      department: department && department !== 'ALL' ? department : null,
      search: search || null
    });

    const semLabel = semester && semester !== 'all' ? `Semester_${semester}` : 'All_Semesters';
    const filename = `Student_Scores_${semLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[ADMIN EXPORT SCORES] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to generate scores Excel file: ' + error.message });
  }
});

/**
 * POST /api/admin/export/scores/email
 * Email the generated 12-parameter scores Excel report as an attachment
 * Body: { email: 'coordinator@example.com', semester: 3 }
 */
router.post('/export/scores/email', async (req, res) => {
  try {
    const { email, semester, department } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid recipient email address is required' });
    }

    const { emailScoresExport } = require('../services/scoreExportService');
    const result = await emailScoresExport({
      recipientEmail: email.trim(),
      semester: semester && semester !== 'all' ? semester : null,
      department: department && department !== 'ALL' ? department : null
    });

    res.json({
      success: true,
      message: `Scores Excel file successfully sent to ${email}`,
      details: result
    });
  } catch (error) {
    console.error('[ADMIN EMAIL SCORES] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to email scores export: ' + error.message });
  }
});

module.exports = router;



