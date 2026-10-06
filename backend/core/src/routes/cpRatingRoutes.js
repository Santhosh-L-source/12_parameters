/**
 * CP Rating Routes
 *
 * Scoring: SINGLE BEST rating across ALL verified platforms (not SUM)
 * Automatically extracts ratings from student's verified profiles in Coding Platform module!
 * Platforms: Codeforces, CodeChef, LeetCode Contest, AtCoder
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

let fetchLeetCodeRating, fetchCodeforcesRating, fetchCodeChefRating, fetchAtCoderRating;
try {
  const rf = require('../../../services/coding-platform/src/fetchers/ratingFetcher');
  fetchLeetCodeRating = rf.fetchLeetCodeRating;
  fetchCodeforcesRating = rf.fetchCodeforcesRating;
  fetchCodeChefRating = rf.fetchCodeChefRating;
  fetchAtCoderRating = rf.fetchAtCoderRating;
} catch (e) {
  console.warn('[CP_RATING] Initial ratingFetcher require warning:', e.message);
}

const router = express.Router();

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
    console.warn('[CP_RATING] Failed to update profile total_score:', err.message);
  }
}

/**
 * Calculate marks for a platform rating (single best threshold)
 */
function calculatePlatformMarks(platform, rating) {
  const r = parseInt(rating) || 0;
  const p = (platform || '').toUpperCase();

  if (p.includes('CODEFORCES')) {
    if (r >= 1800) return { marks: 20, tier: 'Expert' };
    if (r >= 1600) return { marks: 15, tier: 'Specialist' };
    if (r >= 1400) return { marks: 10, tier: 'Pupil' };
    if (r >= 1200) return { marks: 5, tier: 'Newbie' };
    return { marks: 0, tier: 'Unrated' };
  } else if (p.includes('CODECHEF')) {
    if (r >= 2000) return { marks: 20, tier: '5★' };
    if (r >= 1800) return { marks: 15, tier: '4★' };
    if (r >= 1600) return { marks: 10, tier: '3★' };
    if (r >= 1400) return { marks: 5, tier: '2★' };
    return { marks: 0, tier: 'Unrated' };
  } else if (p.includes('LEETCODE')) {
    if (r >= 2000) return { marks: 20, tier: 'Knight' };
    if (r >= 1800) return { marks: 15, tier: 'Guardian' };
    if (r >= 1600) return { marks: 10, tier: 'Intermediate' };
    if (r >= 1400) return { marks: 5, tier: 'Beginner' };
    return { marks: 0, tier: 'Unrated' };
  } else if (p.includes('ATCODER')) {
    if (r >= 1600) return { marks: 20, tier: 'Blue' };
    if (r >= 1200) return { marks: 15, tier: 'Cyan' };
    if (r >= 800) return { marks: 10, tier: 'Green' };
    if (r >= 400) return { marks: 5, tier: 'Brown' };
    return { marks: 0, tier: 'Unrated' };
  } else {
    if (r >= 1600) return { marks: 20, tier: 'Tier 1' };
    if (r >= 1200) return { marks: 15, tier: 'Tier 2' };
    if (r >= 800) return { marks: 10, tier: 'Tier 3' };
    if (r >= 400) return { marks: 5, tier: 'Tier 4' };
    return { marks: 0, tier: 'Unrated' };
  }
}

/**
 * POST /api/cp-rating/submit
 */
router.post(
  '/submit',
  authenticate,
  [
    body('platform').notEmpty().withMessage('platform is required'),
    body('handle').optional().isString(),
    body('username').optional().isString(),
    body('current_rating').optional(),
    body('max_rating').optional(),
    body('profile_url').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const platform = (req.body.platform || '').trim().toUpperCase();
      const handle = (req.body.handle || req.body.username || 'user').trim();
      const currentRating = parseInt(req.body.current_rating) || 0;
      const maxRating = parseInt(req.body.max_rating) || currentRating;
      const profileUrl = req.body.profile_url || null;

      const canonicalRoll = await resolveStudentRoll(studentRoll);
      const distinct_key = `${platform}:${handle}`;
      const distinct_key_norm = distinct_key.toLowerCase().trim();

      const existing = await sequelize.query(
        `SELECT id FROM cp_rating_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) 
           AND (distinct_key_normalized = :distinct_key_norm OR UPPER(platform) = :platform)`,
        {
          replacements: { canonicalRoll, distinct_key_norm, platform },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let evidence;
      let isUpdate = false;

      if (existing.length > 0) {
        isUpdate = true;
        await sequelize.query(
          `UPDATE cp_rating_evidence
           SET handle = :handle,
               distinct_key = :distinct_key,
               current_rating = :currentRating,
               max_rating = :maxRating,
               profile_url = COALESCE(:profileUrl, profile_url),
               status = 'VERIFIED',
               verified_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              handle,
              distinct_key,
              currentRating,
              maxRating,
              profileUrl
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
        evidence = { id: existing[0].id, platform, handle, current_rating: currentRating, max_rating: maxRating, status: 'VERIFIED' };
      } else {
        const insertResult = await sequelize.query(
          `INSERT INTO cp_rating_evidence
           (roll_number, platform, handle, distinct_key, current_rating, max_rating, profile_url, status, submitted_at, verified_at)
           VALUES (:canonicalRoll, :platform, :handle, :distinct_key, :currentRating, :maxRating, :profileUrl, 'VERIFIED', NOW(), NOW())
           RETURNING id, roll_number, platform, handle, current_rating, max_rating, status, submitted_at`,
          {
            replacements: {
              canonicalRoll,
              platform,
              handle,
              distinct_key,
              currentRating,
              maxRating,
              profileUrl
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
        evidence = insertResult && Array.isArray(insertResult) && insertResult[0] && Array.isArray(insertResult[0]) 
          ? insertResult[0][0] 
          : (insertResult && insertResult[0] ? insertResult[0] : {});
      }

      // Recalculate single best marks across verified platforms
      const allVerified = await sequelize.query(
        `SELECT platform, current_rating, max_rating FROM cp_rating_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      let bestMarks = 0;
      for (const e of allVerified) {
        const ratingToUse = Math.max(e.current_rating || 0, e.max_rating || 0);
        const { marks } = calculatePlatformMarks(e.platform, ratingToUse);
        if (marks > bestMarks) bestMarks = marks;
      }

      await sequelize.query(
        `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
         VALUES (:canonicalRoll, 'cp_rating', :bestMarks, 1, false, NOW())
         ON CONFLICT (roll_number, parameter_id, semester)
         DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
        { replacements: { canonicalRoll, bestMarks }, type: sequelize.QueryTypes.INSERT }
      );

      await updateStudentProfileScore(canonicalRoll);

      res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: `CP Rating submitted and verified! Allotted: ${bestMarks}/20 marks`,
        evidence,
        marks: bestMarks
      });
    } catch (err) {
      console.error('[CP_RATING] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/cp-rating/sync-from-coding-platforms
 */
const handleSyncRatings = async (req, res, next) => {
  try {
    const studentRoll = req.user.roll_number || req.user.id_number;
    const canonicalRoll = await resolveStudentRoll(studentRoll);

    // Get all verified coding platform profiles
    const verifiedCoding = await sequelize.query(
      `SELECT platform, username, profile_url FROM coding_problems_evidence
       WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
      { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
    );

    if (!fetchLeetCodeRating) {
      try {
        const rf = require('../../../services/coding-platform/src/fetchers/ratingFetcher');
        fetchLeetCodeRating = rf.fetchLeetCodeRating;
        fetchCodeforcesRating = rf.fetchCodeforcesRating;
        fetchCodeChefRating = rf.fetchCodeChefRating;
        fetchAtCoderRating = rf.fetchAtCoderRating;
      } catch (e) {}
    }

    const syncedList = [];
    let bestMarks = 0;
    let bestRating = 0;
    let bestPlatform = null;
    let bestTier = null;

    for (const item of verifiedCoding) {
      const plat = (item.platform || '').toUpperCase();
      const url = item.profile_url || item.username;
      let fetchedRating = 0;

      if (plat === 'LEETCODE' && fetchLeetCodeRating) {
        fetchedRating = await fetchLeetCodeRating(url);
      } else if (plat === 'CODEFORCES' && fetchCodeforcesRating) {
        fetchedRating = await fetchCodeforcesRating(url);
      } else if (plat === 'CODECHEF' && fetchCodeChefRating) {
        fetchedRating = await fetchCodeChefRating(url);
      } else if (plat === 'ATCODER' && fetchAtCoderRating) {
        fetchedRating = await fetchAtCoderRating(url);
      }

      if (['LEETCODE', 'CODEFORCES', 'CODECHEF', 'ATCODER'].includes(plat)) {
        const { marks, tier } = calculatePlatformMarks(plat, fetchedRating);
        const distinct_key = `${plat}:${item.username}`;
        const distinct_key_norm = distinct_key.toLowerCase().trim();

        const existing = await sequelize.query(
          `SELECT id FROM cp_rating_evidence
           WHERE LOWER(roll_number) = LOWER(:canonicalRoll) 
             AND (distinct_key_normalized = :distinct_key_norm OR UPPER(platform) = :plat)`,
          { replacements: { canonicalRoll, distinct_key_norm, plat }, type: sequelize.QueryTypes.SELECT }
        );

        if (existing.length > 0) {
          await sequelize.query(
            `UPDATE cp_rating_evidence
             SET current_rating = :fetchedRating,
                 max_rating = :fetchedRating,
                 profile_url = :url,
                 handle = :handle,
                 status = 'VERIFIED',
                 verified_at = NOW()
             WHERE id = :id`,
            {
              replacements: {
                id: existing[0].id,
                fetchedRating,
                url,
                handle: item.username
              },
              type: sequelize.QueryTypes.UPDATE
            }
          );
        } else {
          await sequelize.query(
            `INSERT INTO cp_rating_evidence
             (roll_number, platform, handle, distinct_key, current_rating, max_rating, profile_url, status, submitted_at, verified_at)
             VALUES (:canonicalRoll, :plat, :handle, :distinct_key, :fetchedRating, :fetchedRating, :url, 'VERIFIED', NOW(), NOW())`,
            {
              replacements: {
                canonicalRoll,
                plat,
                handle: item.username,
                distinct_key,
                fetchedRating,
                url
              },
              type: sequelize.QueryTypes.INSERT
            }
          );
        }

        syncedList.push({
          platform: plat,
          username: item.username,
          current_rating: fetchedRating,
          max_rating: fetchedRating,
          marks,
          tier
        });

        if (marks > bestMarks || (marks === bestMarks && fetchedRating > bestRating)) {
          bestMarks = marks;
          bestRating = fetchedRating;
          bestPlatform = plat;
          bestTier = tier;
        }
      }
    }

    // Save single best into scores table
    await sequelize.query(
      `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
       VALUES (:canonicalRoll, 'cp_rating', :bestMarks, 1, false, NOW())
       ON CONFLICT (roll_number, parameter_id, semester)
       DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
      { replacements: { canonicalRoll, bestMarks }, type: sequelize.QueryTypes.INSERT }
    );

    await updateStudentProfileScore(canonicalRoll);

    res.json({
      success: true,
      message: `CP ratings synced successfully! Best: ${bestPlatform || 'None'} (${bestRating} rating, ${bestMarks}/20 marks)`,
      marks: bestMarks,
      best_rating: bestRating,
      best_platform: bestPlatform,
      best_tier: bestTier,
      platforms: syncedList
    });
  } catch (err) {
    console.error('[CP_RATING] Sync ratings error:', err.message);
    next(err);
  }
};

router.post('/sync-from-coding-platforms', authenticate, handleSyncRatings);
router.post('/sync', authenticate, handleSyncRatings);

/**
 * GET /api/cp-rating/student/:studentId
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
          handle as username,
          current_rating,
          max_rating,
          profile_url,
          status,
          verified_by_mentor_roll as mentor_id,
          verified_at,
          submitted_at
         FROM cp_rating_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
         ORDER BY current_rating DESC`,
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
      console.error('[CP_RATING] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/cp-rating/pending
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
          e.handle as username,
          e.current_rating,
          e.max_rating,
          e.profile_url,
          e.status,
          e.submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM cp_rating_evidence e
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
      console.error('[CP_RATING] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/cp-rating/:id/verify
 */
router.post(
  '/:id/verify',
  authenticate,
  [
    param('id').isUUID().withMessage('id must be a valid UUID'),
    body('action')
      .isIn(['VERIFIED', 'REJECTED'])
      .withMessage('action must be VERIFIED or REJECTED'),
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
        `SELECT * FROM cp_rating_evidence WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.SELECT }
      );

      if (evidence.length === 0) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      const studentRoll = evidence[0].roll_number;

      await sequelize.query(
        `UPDATE cp_rating_evidence
         SET status = :status,
             verified_by_mentor_roll = :mentorRoll,
             verified_at = NOW()
         WHERE id = :id`,
        { replacements: { id, status: action, mentorRoll }, type: sequelize.QueryTypes.UPDATE }
      );

      if (action === 'VERIFIED') {
        const allVerified = await sequelize.query(
          `SELECT platform, current_rating, max_rating FROM cp_rating_evidence
           WHERE LOWER(roll_number) = LOWER(:studentRoll) AND status = 'VERIFIED'`,
          { replacements: { studentRoll }, type: sequelize.QueryTypes.SELECT }
        );

        let bestMarks = 0;
        for (const e of allVerified) {
          const ratingToUse = Math.max(e.current_rating || 0, e.max_rating || 0);
          const { marks } = calculatePlatformMarks(e.platform, ratingToUse);
          if (marks > bestMarks) bestMarks = marks;
        }

        await sequelize.query(
          `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
           VALUES (:studentRoll, 'cp_rating', :bestMarks, 1, false, NOW())
           ON CONFLICT (roll_number, parameter_id, semester)
           DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
          { replacements: { studentRoll, bestMarks }, type: sequelize.QueryTypes.INSERT }
        );

        await updateStudentProfileScore(studentRoll);
      }

      res.json({ success: true, message: `Evidence ${action.toLowerCase()} successfully`, action });
    } catch (err) {
      console.error('[CP_RATING] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/cp-rating/marks/:studentId
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

      // Check evidence table
      const allVerified = await sequelize.query(
        `SELECT platform, handle, current_rating, max_rating FROM cp_rating_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'
         ORDER BY current_rating DESC`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      let bestMarks = 0;
      let bestRating = 0;
      let bestPlatform = null;
      let bestTier = null;

      const platforms = (allVerified || []).map((e) => {
        const ratingToUse = Math.max(e.current_rating || 0, e.max_rating || 0);
        const { marks, tier } = calculatePlatformMarks(e.platform, ratingToUse);
        if (marks > bestMarks || (marks === bestMarks && ratingToUse > bestRating)) {
          bestMarks = marks;
          bestRating = ratingToUse;
          bestPlatform = e.platform;
          bestTier = tier;
        }
        return {
          platform: e.platform,
          username: e.handle,
          current_rating: e.current_rating || 0,
          max_rating: e.max_rating || e.current_rating || 0,
          marks,
          tier
        };
      });

      // Check scores table as well
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
           AND parameter_id IN ('cp', 'cp_rating', 'cp_score')
         ORDER BY marks DESC LIMIT 1`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      const finalMarks = (scoreRows && scoreRows.length > 0 && parseFloat(scoreRows[0].marks) > 0)
        ? parseFloat(scoreRows[0].marks)
        : bestMarks;

      res.json({
        success: true,
        student_id: canonicalRoll,
        marks: finalMarks,
        best_rating: bestRating,
        best_platform: bestPlatform,
        best_tier: bestTier,
        max_marks: 20,
        platforms_count: platforms.length,
        platforms
      });
    } catch (err) {
      console.error('[CP_RATING] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
