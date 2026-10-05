/**
 * Coding Problems Routes
 *
 * Scoring: SUM total_solved and sql_solved across ALL verified platforms,
 * then check tiers (both conditions must be met):
 *   200 total + 20 SQL → 5 marks
 *   350 total + 30 SQL → 10 marks
 *   550 total + 45 SQL → 15 marks
 *   750 total + 60 SQL → 20 marks
 *   1000 total + 75 SQL → 25 marks
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

// Tier definitions (both thresholds must be met)
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
 * Calculate marks by summing across platforms and checking tiers
 * Returns the highest tier where BOTH total and SQL thresholds are met
 */
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
 * Submit coding problems evidence for a platform
 */
router.post(
  '/submit',
  authenticate,
  [
    body('platform').notEmpty().withMessage('platform is required'),
    body('username').notEmpty().withMessage('username is required'),
    body('total_solved').isInt({ min: 0 }).withMessage('total_solved must be non-negative integer'),
    body('sql_solved').isInt({ min: 0 }).withMessage('sql_solved must be non-negative integer'),
    body('profile_url').optional().isURL(),
    body('fetch_method').optional().isIn(['MANUAL', 'GRAPHQL', 'SCRAPER']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const { platform, username, total_solved, sql_solved, profile_url, fetch_method } = req.body;

      // Validate SQL <= total
      if (sql_solved > total_solved) {
        return res.status(400).json({
          success: false,
          error: 'Invalid data',
          message: 'sql_solved cannot exceed total_solved'
        });
      }

      let finalTotal = total_solved || 0;
      let finalSql = sql_solved || 0;

      // Auto-fetch stats if profile_url is given
      if (profile_url) {
        const fetchedStats = await safeFetchPlatform(platform, profile_url);
        if (fetchedStats && fetchedStats.total > 0) {
          finalTotal = fetchedStats.total;
          finalSql = fetchedStats.sql;
        }
      }

      // distinct_key = platform + username
      const distinct_key = `${platform.trim()}:${username.trim()}`;

      // Check if platform already exists for student
      const existing = await sequelize.query(
        `SELECT id, total_solved, sql_solved, status FROM coding_problems_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND (
           distinct_key_normalized = lower(trim(:distinct_key))
           OR platform = :platform
         )`,
        {
          replacements: { studentId, distinct_key, platform: platform.trim().toUpperCase() },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let evidence;
      let isUpdate = false;

      if (existing.length > 0) {
        // UPSERT: Update existing row with new counts & URL (never overwrite with 0 if previous count > 0)
        isUpdate = true;
        const resolvedTotal = finalTotal > 0 ? finalTotal : (existing[0].total_solved || 0);
        const resolvedSql = finalTotal > 0 ? finalSql : (existing[0].sql_solved || 0);

        await sequelize.query(
          `UPDATE coding_problems_evidence
           SET total_solved = :total_solved,
               sql_solved = :sql_solved,
               profile_url = :profile_url,
               fetch_method = :fetch_method,
               submitted_at = NOW(),
               last_fetched_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              total_solved: resolvedTotal,
              sql_solved: resolvedSql,
              profile_url: profile_url || null,
              fetch_method: fetch_method || 'MANUAL'
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );

        // Fetch updated row
        const updated = await sequelize.query(
          `SELECT * FROM coding_problems_evidence WHERE id = :id`,
          {
            replacements: { id: existing[0].id },
            type: sequelize.QueryTypes.SELECT
          }
        );
        evidence = updated[0];

        // Recalculate marks
        const allVerified = await sequelize.query(
          `SELECT total_solved, sql_solved FROM coding_problems_evidence
           WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND status = 'VERIFIED'`,
          {
            replacements: { studentId },
            type: sequelize.QueryTypes.SELECT
          }
        );

        const totalSolved = allVerified.reduce((sum, e) => sum + (e.total_solved || 0), 0);
        const sqlSolved = allVerified.reduce((sum, e) => sum + (e.sql_solved || 0), 0);
        const marks = calculateCodingProblemsMarks(totalSolved, sqlSolved);

        await sequelize.query(
          `DELETE FROM scores WHERE LOWER(TRIM(register_number)) = LOWER(TRIM(:studentId)) AND parameter = 'coding_problems'`,
          { replacements: { studentId }, type: sequelize.QueryTypes.DELETE }
        );

        if (marks > 0) {
          await sequelize.query(
            `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
             VALUES (:studentId, 'coding_problems', :marks, 1, false, NOW())`,
            { replacements: { studentId, marks }, type: sequelize.QueryTypes.INSERT }
          );
        }
      } else {
        // INSERT new evidence into database
        const result = await sequelize.query(
          `INSERT INTO coding_problems_evidence
           (student_id, platform, username, distinct_key, total_solved, sql_solved,
            profile_url, fetch_method, status, submitted_at)
           VALUES (:studentId, :platform, :username, :distinct_key, :total_solved, :sql_solved,
                   :profile_url, :fetch_method, 'PENDING', NOW())
           RETURNING *`,
          {
            replacements: {
              studentId,
              platform: platform.trim().toUpperCase(),
              username: username.trim(),
              distinct_key,
              total_solved: finalTotal,
              sql_solved: finalSql,
              profile_url: profile_url || null,
              fetch_method: fetch_method || 'MANUAL'
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
        evidence = result[0][0];
      }

      res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: isUpdate
          ? 'Coding problems evidence updated'
          : 'Coding problems evidence submitted successfully',
        is_update: isUpdate,
        evidence: {
          id: evidence.id,
          platform: evidence.platform,
          username: evidence.username,
          total_solved: evidence.total_solved,
          sql_solved: evidence.sql_solved,
          status: evidence.status,
          submitted_at: evidence.submitted_at
        }
      });

    } catch (err) {
      console.error('[CODING_PROBLEMS] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/coding-problems/verify-ownership
 * Instant bio-token ownership verification that promotes status to VERIFIED and calculates marks
 */
router.post(
  '/verify-ownership',
  authenticate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const { platform, profile_url } = req.body;

      if (!platform) {
        return res.status(400).json({ success: false, error: 'Platform is required' });
      }

      // Auto-fetch fresh stats
      let autoTotal = 0;
      let autoSql = 0;
      if (profile_url) {
        const fetchedStats = await safeFetchPlatform(platform, profile_url);
        if (fetchedStats && fetchedStats.total > 0) {
          autoTotal = fetchedStats.total;
          autoSql = fetchedStats.sql;
        }
      }

      // Check existing row
      const existing = await sequelize.query(
        `SELECT id, total_solved, sql_solved FROM coding_problems_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND platform = :platform`,
        {
          replacements: { studentId, platform: platform.trim().toUpperCase() },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (existing.length > 0) {
        const finalTotal = autoTotal > 0 ? autoTotal : (existing[0].total_solved || 0);
        const finalSql = autoTotal > 0 ? autoSql : (existing[0].sql_solved || 0);

        await sequelize.query(
          `UPDATE coding_problems_evidence
           SET status = 'VERIFIED',
               total_solved = :total,
               sql_solved = :sql,
               profile_url = COALESCE(:profile_url, profile_url),
               verified_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              total: finalTotal,
              sql: finalSql,
              profile_url: profile_url || null
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        let username = 'user';
        try {
          const parsed = new URL(profile_url);
          const segs = parsed.pathname.split('/').filter(Boolean);
          username = segs[segs.length - 1] || 'user';
        } catch (_) {}

        await sequelize.query(
          `INSERT INTO coding_problems_evidence
           (student_id, platform, username, distinct_key, total_solved, sql_solved, profile_url, fetch_method, status, submitted_at, verified_at)
           VALUES (:studentId, :platform, :username, :distinct_key, :total, :sql, :profile_url, 'SCRAPER', 'VERIFIED', NOW(), NOW())`,
          {
            replacements: {
              studentId,
              platform: platform.trim().toUpperCase(),
              username,
              distinct_key: `${platform.trim().toUpperCase()}:${username}`,
              total: autoTotal,
              sql: autoSql,
              profile_url: profile_url || null
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      // Recalculate marks across all VERIFIED platforms for this student
      const allVerified = await sequelize.query(
        `SELECT total_solved, sql_solved FROM coding_problems_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND status = 'VERIFIED'`,
        {
          replacements: { studentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      const totalSolved = allVerified.reduce((sum, e) => sum + (e.total_solved || 0), 0);
      const sqlSolved = allVerified.reduce((sum, e) => sum + (e.sql_solved || 0), 0);
      const marks = calculateCodingProblemsMarks(totalSolved, sqlSolved);

      await sequelize.query(
        `DELETE FROM scores WHERE LOWER(TRIM(register_number)) = LOWER(TRIM(:studentId)) AND parameter = 'coding_problems'`,
        { replacements: { studentId }, type: sequelize.QueryTypes.DELETE }
      );

      if (marks > 0) {
        await sequelize.query(
          `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
           VALUES (:studentId, 'coding_problems', :marks, 1, false, NOW())`,
          { replacements: { studentId, marks }, type: sequelize.QueryTypes.INSERT }
        );
      }

      res.json({
        success: true,
        message: `Ownership verified for ${platform}!`,
        marks,
        total_solved_sum: totalSolved,
        sql_solved_sum: sqlSolved
      });
    } catch (err) {
      console.error('[VERIFY_OWNERSHIP] Error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/coding-problems/student/:studentId
 * Get all coding problems evidence for a student
 */
router.get(
  '/student/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;

      if (req.user.roll_number?.toLowerCase() !== studentId?.toLowerCase() && req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only view your own evidence'
        });
      }

      const evidence = await sequelize.query(
        `SELECT * FROM coding_problems_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId))
         ORDER BY submitted_at DESC`,
        {
          replacements: { studentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      // Auto-heal zero counts if profile URL exists
      for (const item of evidence) {
        if ((!item.total_solved || item.total_solved === 0) && item.profile_url) {
          try {
            const fresh = await safeFetchPlatform(item.platform, item.profile_url);
            if (fresh && fresh.total > 0) {
              item.total_solved = fresh.total;
              item.sql_solved = fresh.sql;
              await sequelize.query(
                `UPDATE coding_problems_evidence SET total_solved = :t, sql_solved = :s, last_fetched_at = NOW() WHERE id = :id`,
                { replacements: { t: fresh.total, s: fresh.sql, id: item.id }, type: sequelize.QueryTypes.UPDATE }
              );
            }
          } catch (_) {}
        }
      }

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
 * Get all pending coding problems evidence for mentor review (scoped to mentor's department)
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

      const evidence = await sequelize.query(
        `SELECT
          e.id,
          e.student_id,
          e.platform,
          e.username,
          e.total_solved,
          e.sql_solved,
          e.profile_url,
          e.fetch_method,
          e.status,
          e.submitted_at,
          p.name as student_name,
          p.department
         FROM coding_problems_evidence e
         JOIN profiles p ON e.student_id = p.id_number
         WHERE e.status = 'PENDING'
           AND (
             :mentorRole = 'admin'
             OR p.department = :mentorDepartment
           )
         ORDER BY e.submitted_at ASC`,
        {
          replacements: {
            mentorRole: req.user.role,
            mentorDepartment: req.user.department
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
 * Mentor verifies coding problems evidence
 */
router.post(
  '/:id/verify',
  authenticate,
  [
    param('id').isInt().withMessage('id must be an integer'),
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
      const { id } = req.params;
      const { action, rejection_reason } = req.body;

      // Get evidence
      const evidence = await sequelize.query(
        `SELECT * FROM coding_problems_evidence WHERE id = :id`,
        {
          replacements: { id },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (evidence.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Evidence not found'
        });
      }

      if (evidence[0].status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          message: `Evidence is already ${evidence[0].status}`
        });
      }

      // Update status
      await sequelize.query(
        `UPDATE coding_problems_evidence
         SET status = :status,
             mentor_id = :mentorId,
             verified_at = NOW(),
             rejection_reason = :rejectionReason
         WHERE id = :id`,
        {
          replacements: {
            id,
            status: action,
            mentorId: null, // TODO: Use actual mentor ID
            rejectionReason: action === 'REJECTED' ? rejection_reason : null
          },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // If verified, recalculate marks by summing across all verified platforms
      if (action === 'VERIFIED') {
        const allEvidence = await sequelize.query(
          `SELECT total_solved, sql_solved FROM coding_problems_evidence
           WHERE student_id = :studentId AND status = 'VERIFIED'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.SELECT
          }
        );

        // SUM across all platforms
        const totalSolved = allEvidence.reduce((sum, e) => sum + e.total_solved, 0);
        const sqlSolved = allEvidence.reduce((sum, e) => sum + e.sql_solved, 0);

        // Calculate marks
        const marks = calculateCodingProblemsMarks(totalSolved, sqlSolved);

        // Delete existing score
        await sequelize.query(
          `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'coding_problems'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.DELETE
          }
        );

        // Insert new score
        await sequelize.query(
          `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
           VALUES (:studentId, 'coding_problems', :marks, 1, false, NOW())`,
          {
            replacements: {
              studentId: evidence[0].student_id,
              marks
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      res.json({
        success: true,
        message: `Evidence ${action.toLowerCase()} successfully`,
        action
      });

    } catch (err) {
      console.error('[CODING_PROBLEMS] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/coding-problems/marks/:studentId
 * Calculate marks by summing across all verified platforms
 */
router.get(
  '/marks/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;

      // Get all VERIFIED evidence
      const allEvidence = await sequelize.query(
        `SELECT platform, username, total_solved, sql_solved FROM coding_problems_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND status = 'VERIFIED'`,
        {
          replacements: { studentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      // SUM across all platforms
      const totalSolved = allEvidence.reduce((sum, e) => sum + e.total_solved, 0);
      const sqlSolved = allEvidence.reduce((sum, e) => sum + e.sql_solved, 0);

      // Calculate marks
      const marks = calculateCodingProblemsMarks(totalSolved, sqlSolved);

      // Determine which tier was achieved
      let tierAchieved = null;
      for (const tier of TIERS) {
        if (totalSolved >= tier.total && sqlSolved >= tier.sql) {
          tierAchieved = { total: tier.total, sql: tier.sql, marks: tier.marks };
          break;
        }
      }

      res.json({
        success: true,
        student_id: studentId,
        marks,
        max_marks: 25,
        platforms_count: allEvidence.length,
        total_solved_sum: totalSolved,
        sql_solved_sum: sqlSolved,
        tier_achieved: tierAchieved,
        platforms: allEvidence.map(e => ({
          platform: e.platform,
          username: e.username,
          total_solved: e.total_solved,
          sql_solved: e.sql_solved
        }))
      });

    } catch (err) {
      console.error('[CODING_PROBLEMS] Calculate marks error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/coding-problems/remove
 * or DELETE /api/coding-problems/remove/:platform
 * Remove a platform profile and recalculate marks
 */
const handleRemovePlatform = async (req, res, next) => {
  try {
    const studentId = req.user.roll_number || req.user.id_number;
    const platform = req.body.platform || req.params.platform;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'Platform is required'
      });
    }

    const platUpper = platform.trim().toUpperCase();

    // 1. Delete evidence row for this student and platform
    await sequelize.query(
      `DELETE FROM coding_problems_evidence
       WHERE (LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)))
         AND UPPER(TRIM(platform)) = :platUpper`,
      {
        replacements: { studentId, platUpper },
        type: sequelize.QueryTypes.DELETE
      }
    );

    // 2. Recalculate totals from all remaining VERIFIED platforms
    const remainingVerified = await sequelize.query(
      `SELECT total_solved, sql_solved FROM coding_problems_evidence
       WHERE (LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)))
         AND status = 'VERIFIED'`,
      {
        replacements: { studentId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const totalSolved = remainingVerified.reduce((sum, e) => sum + (Number(e.total_solved) || 0), 0);
    const sqlSolved = remainingVerified.reduce((sum, e) => sum + (Number(e.sql_solved) || 0), 0);
    const marks = calculateCodingProblemsMarks(totalSolved, sqlSolved);

    // 3. Update parameter row in scores
    await sequelize.query(
      `DELETE FROM scores 
       WHERE (LOWER(TRIM(register_number)) = LOWER(TRIM(:studentId))) 
         AND parameter = 'coding_problems'`,
      { replacements: { studentId }, type: sequelize.QueryTypes.DELETE }
    );

    if (marks > 0) {
      await sequelize.query(
        `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
         VALUES (:studentId, 'coding_problems', :marks, 1, false, NOW())`,
        { replacements: { studentId, marks }, type: sequelize.QueryTypes.INSERT }
      );
    }

    // 4. Also update master row coding_score and recalculate total_score
    try {
      await sequelize.query(
        `UPDATE scores
         SET coding_score = :marks,
             total_score = COALESCE(hundred_days_score, 0) + COALESCE(language_score, 0) + 
                           COALESCE(gate_score, 0) + COALESCE(competition_score, 0) + 
                           COALESCE(internship_score, 0) + COALESCE(certificate_score, 0) + 
                           COALESCE(aptitude_score, 0) + :marks + 
                           COALESCE(cp_score, 0) + COALESCE(oss_score, 0) + 
                           COALESCE(month_score, 0) + COALESCE(proj_score, 0),
             calculated_at = NOW(),
             updated_at = NOW()
         WHERE LOWER(TRIM(register_number)) = LOWER(TRIM(:studentId)) AND academic_year IS NOT NULL`,
        { replacements: { studentId, marks }, type: sequelize.QueryTypes.UPDATE }
      );
    } catch (_) {}

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
