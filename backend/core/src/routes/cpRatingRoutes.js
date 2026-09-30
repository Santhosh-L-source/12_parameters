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
const { fetchRatingForPlatform } = require('../../../services/coding-platform/src/fetchers/ratingFetcher');

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
 * Calculate marks for a single platform rating by querying parameter_tiers table
 */
async function calculatePlatformMarks(platform, rating) {
  let plat = platform;
  if (plat === 'LEETCODE') plat = 'LEETCODE_CONTEST';

  const tiers = await sequelize.query(
    `SELECT threshold, marks, tier_name FROM parameter_tiers
     WHERE parameter = 'cp_rating' AND platform = :platform
     ORDER BY threshold DESC`,
    {
      replacements: { platform: plat },
      type: sequelize.QueryTypes.SELECT
    }
  );

  for (const tier of tiers) {
    if (rating >= tier.threshold) {
      return { marks: tier.marks, tier_name: tier.tier_name, threshold: tier.threshold };
    }
  }
  return { marks: 0, tier_name: null, threshold: null };
}

/**
 * Auto-extract ratings from verified Coding Platform profiles
 */
async function syncRatingsFromCodingPlatforms(studentId) {
  try {
    const codingRecords = await sequelize.query(
      `SELECT platform, username, profile_url, status FROM coding_problems_evidence
       WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId))`,
      { replacements: { studentId }, type: sequelize.QueryTypes.SELECT }
    );

    for (const record of codingRecords) {
      const platformKey = (record.platform || '').toUpperCase();
      let cpPlatform = platformKey;
      if (platformKey === 'LEETCODE') cpPlatform = 'LEETCODE_CONTEST';

      if (['LEETCODE', 'LEETCODE_CONTEST', 'CODEFORCES', 'CODECHEF', 'ATCODER'].includes(platformKey) && record.profile_url) {
        const rating = await fetchRatingForPlatform(platformKey, record.profile_url, record.username);
        if (rating > 0) {
          const distinct_key = `${cpPlatform}:${record.username}`;
          const existing = await sequelize.query(
            `SELECT id FROM cp_rating_evidence
             WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND platform = :cpPlatform`,
            { replacements: { studentId, cpPlatform }, type: sequelize.QueryTypes.SELECT }
          );

          if (existing.length > 0) {
            await sequelize.query(
              `UPDATE cp_rating_evidence
               SET current_rating = :rating,
                   profile_url = :profile_url,
                   status = 'VERIFIED',
                   verified_at = NOW(),
                   last_fetched_at = NOW()
               WHERE id = :id`,
              {
                replacements: { id: existing[0].id, rating, profile_url: record.profile_url },
                type: sequelize.QueryTypes.UPDATE
              }
            );
          } else {
            await sequelize.query(
              `INSERT INTO cp_rating_evidence
               (student_id, platform, username, distinct_key, current_rating, profile_url, fetch_method, status, submitted_at, verified_at, last_fetched_at)
               VALUES (:studentId, :cpPlatform, :username, :distinct_key, :rating, :profile_url, 'API', 'VERIFIED', NOW(), NOW(), NOW())`,
              {
                replacements: {
                  studentId,
                  cpPlatform,
                  username: record.username,
                  distinct_key,
                  rating,
                  profile_url: record.profile_url
                },
                type: sequelize.QueryTypes.INSERT
              }
            );
          }
        }
      }
    }

    // Recalculate single best marks
    const allVerified = await sequelize.query(
      `SELECT platform, current_rating FROM cp_rating_evidence
       WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND status = 'VERIFIED'`,
      { replacements: { studentId }, type: sequelize.QueryTypes.SELECT }
    );

    let bestMarks = 0;
    for (const e of allVerified) {
      const result = await calculatePlatformMarks(e.platform, e.current_rating);
      if (result.marks > bestMarks) bestMarks = result.marks;
    }

    await sequelize.query(
      `DELETE FROM scores WHERE LOWER(TRIM(register_number)) = LOWER(TRIM(:studentId)) AND parameter = 'cp_rating'`,
      { replacements: { studentId }, type: sequelize.QueryTypes.DELETE }
    );

    if (bestMarks > 0) {
      await sequelize.query(
        `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
         VALUES (:studentId, 'cp_rating', :marks, 1, false, NOW())`,
        { replacements: { studentId, marks: bestMarks }, type: sequelize.QueryTypes.INSERT }
      );
    }
  } catch (err) {
    console.warn('[CP_RATING Sync Warning]:', err.message);
  }
}

/**
 * POST /api/cp-rating/sync-from-coding-platforms
 * Manually or automatically trigger sync from coding platforms
 */
router.post(
  '/sync-from-coding-platforms',
  authenticate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      await syncRatingsFromCodingPlatforms(studentId);

      const evidence = await sequelize.query(
        `SELECT * FROM cp_rating_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId))
         ORDER BY current_rating DESC`,
        { replacements: { studentId }, type: sequelize.QueryTypes.SELECT }
      );

      res.json({
        success: true,
        message: 'CP Ratings synchronized from verified coding platforms!',
        evidence: evidence || []
      });
    } catch (err) {
      console.error('[CP_RATING] Sync error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/cp-rating/submit
 * Submit CP rating evidence manually (UPSERT)
 */
router.post(
  '/submit',
  authenticate,
  [
    body('platform').notEmpty().withMessage('platform is required'),
    body('username').notEmpty().withMessage('username is required'),
    body('current_rating').optional().isInt({ min: 0 }),
    body('profile_url').optional().isURL(),
    body('fetch_method').optional().isIn(['MANUAL', 'API', 'SCRAPER']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const { platform, username, profile_url, fetch_method } = req.body;

      let current_rating = parseInt(req.body.current_rating, 10) || 0;

      // If rating not provided or 0, attempt auto-fetch
      if (!current_rating && profile_url) {
        current_rating = await fetchRatingForPlatform(platform, profile_url, username);
      }

      const distinct_key = `${platform.trim().toUpperCase()}:${username.trim()}`;

      const existing = await sequelize.query(
        `SELECT id FROM cp_rating_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND (
           distinct_key_normalized = lower(trim(:distinct_key))
           OR platform = :platform
         )`,
        {
          replacements: { studentId, distinct_key, platform: platform.trim().toUpperCase() },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let isUpdate = false;
      if (existing.length > 0) {
        isUpdate = true;
        await sequelize.query(
          `UPDATE cp_rating_evidence
           SET current_rating = :current_rating,
               profile_url = :profile_url,
               fetch_method = :fetch_method,
               status = 'VERIFIED',
               submitted_at = NOW(),
               verified_at = NOW(),
               last_fetched_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              current_rating,
              profile_url: profile_url || null,
              fetch_method: fetch_method || 'API'
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        await sequelize.query(
          `INSERT INTO cp_rating_evidence
           (student_id, platform, username, distinct_key, current_rating,
            profile_url, fetch_method, status, submitted_at, verified_at, last_fetched_at)
           VALUES (:studentId, :platform, :username, :distinct_key, :current_rating,
                   :profile_url, :fetch_method, 'VERIFIED', NOW(), NOW(), NOW())`,
          {
            replacements: {
              studentId,
              platform: platform.trim().toUpperCase(),
              username: username.trim(),
              distinct_key,
              current_rating,
              profile_url: profile_url || null,
              fetch_method: fetch_method || 'API'
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      // Recalculate single best rating marks
      const allVerified = await sequelize.query(
        `SELECT platform, current_rating FROM cp_rating_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND status = 'VERIFIED'`,
        { replacements: { studentId }, type: sequelize.QueryTypes.SELECT }
      );

      let bestMarks = 0;
      for (const e of allVerified) {
        const result = await calculatePlatformMarks(e.platform, e.current_rating);
        if (result.marks > bestMarks) bestMarks = result.marks;
      }

      await sequelize.query(
        `DELETE FROM scores WHERE LOWER(TRIM(register_number)) = LOWER(TRIM(:studentId)) AND parameter = 'cp_rating'`,
        { replacements: { studentId }, type: sequelize.QueryTypes.DELETE }
      );

      if (bestMarks > 0) {
        await sequelize.query(
          `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
           VALUES (:studentId, 'cp_rating', :marks, 1, false, NOW())`,
          { replacements: { studentId, marks: bestMarks }, type: sequelize.QueryTypes.INSERT }
        );
      }

      res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: isUpdate
          ? 'CP rating evidence updated and verified'
          : 'CP rating evidence submitted and verified successfully',
        current_rating
      });

    } catch (err) {
      console.error('[CP_RATING] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/cp-rating/student/:studentId
 * Get all CP rating evidence for a student (with automatic sync)
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

      // Automatically sync ratings from verified coding platform profiles
      await syncRatingsFromCodingPlatforms(studentId);

      const evidence = await sequelize.query(
        `SELECT * FROM cp_rating_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId))
         ORDER BY current_rating DESC`,
        {
          replacements: { studentId },
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
 * GET /api/cp-rating/marks/:studentId
 * Calculate marks using SINGLE BEST rating across all verified platforms
 */
router.get(
  '/marks/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;

      const allEvidence = await sequelize.query(
        `SELECT platform, username, current_rating FROM cp_rating_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND status = 'VERIFIED'`,
        {
          replacements: { studentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let bestMarks = 0;
      let bestPlatform = null;
      let bestRating = 0;
      let bestTier = null;

      const platformResults = await Promise.all(
        allEvidence.map(async (e) => {
          const result = await calculatePlatformMarks(e.platform, e.current_rating);
          if (result.marks > bestMarks) {
            bestMarks = result.marks;
            bestPlatform = e.platform;
            bestRating = e.current_rating;
            bestTier = result.tier_name;
          }
          return {
            platform: e.platform,
            username: e.username,
            rating: e.current_rating,
            marks: result.marks,
            tier: result.tier_name
          };
        })
      );

      res.json({
        success: true,
        student_id: studentId,
        marks: bestMarks,
        max_marks: 20,
        platforms_count: allEvidence.length,
        best_platform: bestPlatform,
        best_rating: bestRating,
        best_tier: bestTier,
        platforms: platformResults
      });

    } catch (err) {
      console.error('[CP_RATING] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
