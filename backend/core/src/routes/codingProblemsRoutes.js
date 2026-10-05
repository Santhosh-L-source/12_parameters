/**
 * Coding Problems Routes
 *
 * Scoring: SUM total_solved and sql_solved across ALL verified platforms,
 * then check tiers (both conditions must be met):
 *   200 total + 20 SQL -> 5 marks
 *   350 total + 30 SQL -> 10 marks
 *   550 total + 45 SQL -> 15 marks
 *   750 total + 60 SQL -> 20 marks
 *   1000 total + 75 SQL -> 25 marks
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

let getFetcher = null;
try {
  getFetcher = require('../../../services/coding-platform/src/fetchers').getFetcher;
} catch (e) {
  console.warn('[CodingProblems] Initial getFetcher require:', e.message);
}

async function safeFetchPlatform(platform, profileUrl) {
  if (!profileUrl) return null;
  try {
    if (!getFetcher) {
      getFetcher = require('../../../services/coding-platform/src/fetchers').getFetcher;
    }
    const fetcher = getFetcher(platform.trim().toUpperCase());
    if (fetcher) {
      const res = await fetcher(profileUrl);
      if (res && typeof res.totalProblemsSolved === 'number') {
        return {
          total: res.totalProblemsSolved,
          sql: res.sqlProblemsSolved || 0
        };
      }
    }
  } catch (err) {
    console.warn(`[CodingProblems] safeFetchPlatform error for ${platform}:`, err.message);
  }
  return null;
}

const router = express.Router();

const TIERS = [
  { total: 1000, sql: 75, marks: 25 },
  { total: 750, sql: 60, marks: 20 },
  { total: 550, sql: 45, marks: 15 },
  { total: 350, sql: 30, marks: 10 },
  { total: 200, sql: 20, marks: 5 }
];

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

/**
 * Helper to resolve canonical roll_number for a student ID or register number
 */
async function resolveStudentRoll(idOrReg) {
  if (!idOrReg) return null;
  const cleanId = String(idOrReg).trim();
  const rows = await sequelize.query(
    `SELECT roll_number, register_number, name, department 
     FROM students 
     WHERE LOWER(roll_number) = LOWER(:cleanId) 
        OR (register_number IS NOT NULL AND LOWER(register_number) = LOWER(:cleanId))
     LIMIT 1`,
    {
      replacements: { cleanId },
      type: sequelize.QueryTypes.SELECT
    }
  );
  if (rows && rows.length > 0) {
    return rows[0].roll_number;
  }
  return cleanId;
}

/**
 * Helper to update profile readiness scores after marks change
 */
async function updateStudentProfileScore(rollNumber) {
  try {
    await sequelize.query(
      `UPDATE profiles
       SET total_score = (
         SELECT COALESCE(SUM(marks), 0) 
         FROM scores 
         WHERE LOWER(roll_number) = LOWER(:rollNumber)
       ),
       coding_score = (
         SELECT COALESCE(SUM(marks), 0)
         FROM scores
         WHERE LOWER(roll_number) = LOWER(:rollNumber)
           AND parameter_id IN ('coding', 'coding_problems', 'cp', 'cp_rating', 'month', 'monthly_coding', 'hundred_days')
       ),
       updated_at = NOW()
       WHERE LOWER(roll_number) = LOWER(:rollNumber)`,
      {
        replacements: { rollNumber },
        type: sequelize.QueryTypes.UPDATE
      }
    );
  } catch (err) {
    console.warn('[CODING_PROBLEMS] Failed to update profile total_score:', err.message);
  }
}

function calculateCodingProblemsMarks(totalSolved, sqlSolved) {
  for (const tier of TIERS) {
    if (totalSolved >= tier.total && sqlSolved >= tier.sql) {
      return tier.marks;
    }
  }
  return 0;
}

/**
 * POST /api/coding-problems/submit
 */
router.post(
  '/submit',
  authenticate,
  [
    body('platform').notEmpty().withMessage('platform is required'),
    body('username').notEmpty().withMessage('username is required'),
    body('total_solved').optional(),
    body('sql_solved').optional(),
    body('profile_url').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const { platform, username, total_solved = 0, sql_solved = 0, profile_url, fetch_method } = req.body;

      let finalTotal = parseInt(total_solved) || 0;
      let finalSql = parseInt(sql_solved) || 0;

      if (profile_url) {
        const fetchedStats = await safeFetchPlatform(platform, profile_url);
        if (fetchedStats && fetchedStats.total > 0) {
          finalTotal = fetchedStats.total;
          finalSql = fetchedStats.sql;
        }
      }

      const canonicalRoll = await resolveStudentRoll(studentRoll);
      const platUpper = platform.trim().toUpperCase();
      const distinct_key = `${platUpper}:${username.trim()}`;
      const distinct_key_norm = distinct_key.toLowerCase().trim();

      const existing = await sequelize.query(
        `SELECT id, total_solved, sql_solved, status FROM coding_problems_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) 
           AND (distinct_key_normalized = :distinct_key_norm OR UPPER(platform) = :platUpper)`,
        {
          replacements: { canonicalRoll, distinct_key_norm, platUpper },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let isUpdate = false;
      let evidence;

      if (existing.length > 0) {
        isUpdate = true;
        const resTotal = finalTotal > 0 ? finalTotal : (existing[0].total_solved || 0);
        const resSql = finalTotal > 0 ? finalSql : (existing[0].sql_solved || 0);

        await sequelize.query(
          `UPDATE coding_problems_evidence
           SET total_solved = :total_solved,
               sql_solved = :sql_solved,
               profile_url = COALESCE(:profile_url, profile_url),
               username = :username,
               distinct_key = :distinct_key,
               distinct_key_normalized = :distinct_key_norm,
               status = 'VERIFIED',
               verified_at = NOW(),
               last_fetched_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              total_solved: resTotal,
              sql_solved: resSql,
              profile_url: profile_url || null,
              username: username.trim(),
              distinct_key,
              distinct_key_norm
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
        evidence = { id: existing[0].id, platform: platUpper, username, total_solved: resTotal, sql_solved: resSql, status: 'VERIFIED' };
      } else {
        const insertResult = await sequelize.query(
          `INSERT INTO coding_problems_evidence
           (roll_number, platform, username, distinct_key, distinct_key_normalized,
            total_solved, sql_solved, profile_url, fetch_method, status, submitted_at, verified_at, last_fetched_at)
           VALUES (:canonicalRoll, :platUpper, :username, :distinct_key, :distinct_key_norm,
                   :finalTotal, :finalSql, :profile_url, :fetch_method, 'VERIFIED', NOW(), NOW(), NOW())
           RETURNING id, roll_number, platform, username, total_solved, sql_solved, status, submitted_at`,
          {
            replacements: {
              canonicalRoll,
              platUpper,
              username: username.trim(),
              distinct_key,
              distinct_key_norm,
              finalTotal,
              finalSql,
              profile_url: profile_url || null,
              fetch_method: fetch_method || (profile_url ? 'SCRAPER' : 'MANUAL')
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
        evidence = insertResult[0][0];
      }

      // Automatically recalculate marks across all verified platforms
      const allVerified = await sequelize.query(
        `SELECT total_solved, sql_solved FROM coding_problems_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      const totalSolved = allVerified.reduce((sum, e) => sum + (e.total_solved || 0), 0);
      const sqlSolved = allVerified.reduce((sum, e) => sum + (e.sql_solved || 0), 0);
      const marks = calculateCodingProblemsMarks(totalSolved, sqlSolved);

      await sequelize.query(
        `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
         VALUES (:canonicalRoll, 'coding', :marks, 1, false, NOW())
         ON CONFLICT (roll_number, parameter_id, semester)
         DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
        { replacements: { canonicalRoll, marks }, type: sequelize.QueryTypes.INSERT }
      );

      await updateStudentProfileScore(canonicalRoll);

      res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: `Coding problems stats verified! Marks: ${marks}/25 (Total: ${totalSolved}, SQL: ${sqlSolved})`,
        evidence,
        marks,
        total_solved_sum: totalSolved,
        sql_solved_sum: sqlSolved
      });
    } catch (err) {
      console.error('[CODING_PROBLEMS] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/coding-problems/student/:studentId
 */
router.get(
  '/student/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const canonicalRoll = await resolveStudentRoll(studentId);

      const reqRoll = req.user.roll_number || req.user.id_number;
      if (req.user.role !== 'mentor' && req.user.role !== 'admin' && reqRoll.toLowerCase() !== studentId.toLowerCase() && reqRoll.toLowerCase() !== canonicalRoll.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only view your own evidence'
        });
      }

      const evidence = await sequelize.query(
        `SELECT 
          id,
          roll_number as student_id,
          platform,
          username,
          total_solved,
          sql_solved,
          profile_url,
          fetch_method,
          status,
          verified_by_mentor_roll as mentor_id,
          verified_at,
          submitted_at
         FROM coding_problems_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
         ORDER BY submitted_at DESC`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      res.json({
        success: true,
        evidence: evidence || []
      });
    } catch (err) {
      console.error('[CODING_PROBLEMS] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/coding-problems/pending
 */
router.get(
  '/pending',
  authenticate,
  async (req, res, next) => {
    try {
      if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only mentors can access this endpoint'
        });
      }

      const mentorDept = req.user.department;
      const mentorRole = req.user.role;
      const mentorRoll = req.user.roll_number || req.user.id_number;

      const evidence = await sequelize.query(
        `SELECT
          e.id,
          e.roll_number as student_id,
          e.platform,
          e.username,
          e.total_solved,
          e.sql_solved,
          e.profile_url,
          e.fetch_method,
          e.status,
          e.submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM coding_problems_evidence e
         JOIN students s ON LOWER(e.roll_number) = LOWER(s.roll_number)
         WHERE e.status = 'PENDING'
           AND (
             :mentorRole = 'admin'
             OR :mentorDept = 'ALL'
             OR s.mentor_roll_number = :mentorRoll
             OR (s.mentor_roll_number IS NULL AND s.department = :mentorDept)
           )
         ORDER BY e.submitted_at ASC`,
        {
          replacements: {
            mentorRole,
            mentorDept,
            mentorRoll
          },
          type: sequelize.QueryTypes.SELECT
        }
      );

      res.json({
        success: true,
        evidence: evidence || [],
        count: evidence?.length || 0
      });
    } catch (err) {
      console.error('[CODING_PROBLEMS] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/coding-problems/:id/verify
 */
router.post(
  '/:id/verify',
  authenticate,
  [
    param('id').isUUID().withMessage('id must be a valid UUID'),
    body('action')
      .isIn(['VERIFIED', 'REJECTED'])
      .withMessage('action must be VERIFIED or REJECTED'),
    body('rejection_reason')
      .if(body('action').equals('REJECTED'))
      .notEmpty()
      .withMessage('rejection_reason is required when rejecting'),
  ],
  validate,
  async (req, res, next) => {
    try {
      if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only mentors and administrators can verify evidence'
        });
      }

      const { id } = req.params;
      const { action } = req.body;
      const mentorRoll = req.user.roll_number || req.user.id_number || 'MENTOR';

      const evidence = await sequelize.query(
        `SELECT * FROM coding_problems_evidence WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.SELECT }
      );

      if (evidence.length === 0) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      const studentRoll = evidence[0].roll_number;

      await sequelize.query(
        `UPDATE coding_problems_evidence
         SET status = :status,
             verified_by_mentor_roll = :mentorRoll,
             verified_at = NOW()
         WHERE id = :id`,
        {
          replacements: { id, status: action, mentorRoll },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      if (action === 'VERIFIED') {
        const allVerified = await sequelize.query(
          `SELECT total_solved, sql_solved FROM coding_problems_evidence
           WHERE LOWER(roll_number) = LOWER(:studentRoll) AND status = 'VERIFIED'`,
          { replacements: { studentRoll }, type: sequelize.QueryTypes.SELECT }
        );

        const totalSolved = allVerified.reduce((sum, e) => sum + (e.total_solved || 0), 0);
        const sqlSolved = allVerified.reduce((sum, e) => sum + (e.sql_solved || 0), 0);
        const marks = calculateCodingProblemsMarks(totalSolved, sqlSolved);

        await sequelize.query(
          `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
           VALUES (:studentRoll, 'coding', :marks, 1, false, NOW())
           ON CONFLICT (roll_number, parameter_id, semester)
           DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
          { replacements: { studentRoll, marks }, type: sequelize.QueryTypes.INSERT }
        );

        await updateStudentProfileScore(studentRoll);
      }

      res.json({ success: true, message: `Evidence ${action.toLowerCase()} successfully`, action });
    } catch (err) {
      console.error('[CODING_PROBLEMS] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/coding-problems/marks/:studentId
 */
router.get(
  '/marks/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const canonicalRoll = await resolveStudentRoll(studentId);

      // 1. Check scores table first
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
           AND parameter_id IN ('coding', 'coding_problems', 'coding_score')
         ORDER BY marks DESC LIMIT 1`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      if (scoreRows && scoreRows.length > 0 && parseFloat(scoreRows[0].marks) > 0) {
        return res.json({
          success: true,
          student_id: canonicalRoll,
          marks: parseFloat(scoreRows[0].marks),
          max_marks: 25
        });
      }

      // 2. Check evidence table
      const allEvidence = await sequelize.query(
        `SELECT platform, username, total_solved, sql_solved FROM coding_problems_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      const totalSolved = (allEvidence || []).reduce((sum, e) => sum + (e.total_solved || 0), 0);
      const sqlSolved = (allEvidence || []).reduce((sum, e) => sum + (e.sql_solved || 0), 0);
      const marks = calculateCodingProblemsMarks(totalSolved, sqlSolved);

      res.json({
        success: true,
        student_id: canonicalRoll,
        marks,
        max_marks: 25,
        platforms_count: allEvidence ? allEvidence.length : 0,
        total_solved_sum: totalSolved,
        sql_solved_sum: sqlSolved,
        platforms: allEvidence || []
      });
    } catch (err) {
      console.error('[CODING_PROBLEMS] Calculate marks error:', err.message);
      next(err);
    }
  }
);

/**
 * DELETE /api/coding-problems/remove/:platform or POST /remove
 */
const handleRemovePlatform = async (req, res, next) => {
  try {
    const studentRoll = req.user.roll_number || req.user.id_number;
    const platform = req.body.platform || req.params.platform;
    const canonicalRoll = await resolveStudentRoll(studentRoll);

    if (!platform) {
      return res.status(400).json({ success: false, message: 'Platform is required' });
    }

    const platUpper = platform.trim().toUpperCase();

    await sequelize.query(
      `DELETE FROM coding_problems_evidence
       WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND UPPER(platform) = :platUpper`,
      { replacements: { canonicalRoll, platUpper }, type: sequelize.QueryTypes.DELETE }
    );

    const remainingVerified = await sequelize.query(
      `SELECT total_solved, sql_solved FROM coding_problems_evidence
       WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
      { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
    );

    const totalSolved = remainingVerified.reduce((sum, e) => sum + (Number(e.total_solved) || 0), 0);
    const sqlSolved = remainingVerified.reduce((sum, e) => sum + (Number(e.sql_solved) || 0), 0);
    const marks = calculateCodingProblemsMarks(totalSolved, sqlSolved);

    await sequelize.query(
      `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
       VALUES (:canonicalRoll, 'coding', :marks, 1, false, NOW())
       ON CONFLICT (roll_number, parameter_id, semester)
       DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
      { replacements: { canonicalRoll, marks }, type: sequelize.QueryTypes.INSERT }
    );

    await updateStudentProfileScore(canonicalRoll);

    res.json({
      success: true,
      message: `${platform} profile removed successfully`,
      marks,
      total_solved_sum: totalSolved,
      sql_solved_sum: sqlSolved
    });
  } catch (err) {
    console.error('[CODING_PROBLEMS] Remove error:', err.message);
    next(err);
  }
};

router.post('/remove', authenticate, handleRemovePlatform);
router.delete('/remove/:platform', authenticate, handleRemovePlatform);

module.exports = router;
