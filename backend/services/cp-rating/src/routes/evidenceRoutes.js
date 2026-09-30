const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const CPRatingEvidence = require('../models/CPRatingEvidence');
const { VALID_PLATFORMS, calculatePlatformMarks, calculateStudentCPMarks, MAX_MARKS, MILESTONES, getAchievedMilestone, getNextMilestone } = require('../config/cpRatingThresholds');
const { fetchRating, SUPPORTED_PLATFORMS } = require('../fetchers/ratingFetchers');
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/evidence/cp-rating/fetch-ratings/:studentId
// Auto-fetch ratings from platforms linked in coding_evidence table
router.post(
  '/fetch-ratings/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;

      // Read linked platforms from coding_evidence table (shared DB)
      const linkedProfiles = await sequelize.query(
        `SELECT platform, profile_url, semester FROM coding_evidence WHERE student_id = :studentId`,
        { replacements: { studentId }, type: QueryTypes.SELECT }
      );

      if (!linkedProfiles.length) {
        return res.status(404).json({
          error: 'No linked platform profiles found. Link your profiles in the Coding Platform module first.',
        });
      }

      // Filter to only CP-rating-supported platforms
      const ratingPlatforms = linkedProfiles.filter(p =>
        SUPPORTED_PLATFORMS.includes(p.platform.toUpperCase())
      );

      if (!ratingPlatforms.length) {
        return res.status(404).json({
          error: 'No rating-supported platforms found. Link Codeforces, CodeChef, AtCoder, or LeetCode in the Coding Platform module.',
          linkedPlatforms: linkedProfiles.map(p => p.platform),
          supportedPlatforms: SUPPORTED_PLATFORMS,
        });
      }

      const results = [];

      for (const profile of ratingPlatforms) {
        const platform = profile.platform.toUpperCase();
        const profileUrl = profile.profile_url;

        console.log(`Fetching ${platform} rating from ${profileUrl}...`);
        const ratingData = await fetchRating(platform, profileUrl);

        if (!ratingData || ratingData.error) {
          results.push({
            platform,
            status: 'FETCH_FAILED',
            error: ratingData?.error || 'Unknown error',
            rating: 0,
          });
          continue;
        }

        const currentRating = ratingData.rating || 0;
        const tierMarks = calculatePlatformMarks(platform, currentRating);

        // Upsert into cp_rating_evidence
        let evidence = await CPRatingEvidence.findOne({
          where: { studentId, platform },
        });

        if (evidence) {
          evidence.currentRating = currentRating;
          evidence.proofUrl = profileUrl;
          evidence.semester = profile.semester || evidence.semester;
          evidence.fetchedAt = new Date();
          await evidence.save();
        } else {
          evidence = await CPRatingEvidence.create({
            studentId,
            semester: profile.semester || 1,
            platform,
            currentRating,
            proofUrl: profileUrl,
            fetchedAt: new Date(),
          });
        }

        results.push({
          platform,
          handle: ratingData.handle,
          rating: currentRating,
          maxRating: ratingData.maxRating || ratingData.highestRating || null,
          rank: ratingData.rank || null,
          tierMarks,
          status: 'FETCHED',
          evidenceId: evidence.id,
        });
      }

      res.json({
        message: `Fetched ratings for ${results.filter(r => r.status === 'FETCHED').length}/${ratingPlatforms.length} platforms`,
        results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/evidence/cp-rating — submit CP rating evidence (manual fallback)
router.post(
  '/',
  [
    body('studentId').notEmpty().withMessage('studentId is required'),
    body('semester').isInt({ min: 1, max: 10 }).withMessage('semester must be 1-10'),
    body('platform')
      .notEmpty()
      .isIn(VALID_PLATFORMS)
      .withMessage(`platform must be one of: ${VALID_PLATFORMS.join(', ')}`),
    body('currentRating').isInt({ min: 0 }).withMessage('currentRating must be a non-negative integer'),
    body('proofUrl').isURL().withMessage('proofUrl must be a valid URL'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { studentId, semester, platform, currentRating, proofUrl } = req.body;

      let evidence = await CPRatingEvidence.findOne({
        where: { studentId, platform },
      });

      if (evidence) {
        evidence.semester = semester;
        evidence.currentRating = currentRating;
        evidence.proofUrl = proofUrl;
        evidence.fetchedAt = new Date();
        await evidence.save();
      } else {
        evidence = await CPRatingEvidence.create({
          studentId, semester, platform, currentRating, proofUrl, fetchedAt: new Date(),
        });
      }

      const tierMarks = calculatePlatformMarks(platform, currentRating);

      res.status(201).json({
        message: 'CP rating evidence submitted',
        evidence: evidence.toJSON(),
        tierMarks,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/evidence/cp-rating/student/:studentId — all evidence for a student
router.get(
  '/student/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CPRatingEvidence.findAll({
        where: { studentId: req.params.studentId },
        order: [['platform', 'ASC']],
      });
      res.json(evidence);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/evidence/cp-rating/marks/:studentId — calculate marks (all fetched evidence)
router.get(
  '/marks/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CPRatingEvidence.findAll({
        where: { studentId: req.params.studentId },
      });

      const marks = calculateStudentCPMarks(evidence);

      const breakdown = evidence.map((ev) => ({
        platform: ev.platform,
        currentRating: ev.currentRating,
        tierMarks: calculatePlatformMarks(ev.platform, ev.currentRating),
        achievedMilestone: getAchievedMilestone(ev.platform, ev.currentRating),
        nextMilestone: getNextMilestone(ev.platform, ev.currentRating),
      }));

      res.json({
        marks,
        maxMarks: MAX_MARKS,
        platformCount: evidence.length,
        breakdown,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/evidence/cp-rating/linked-platforms/:studentId — check which platforms are linked
router.get(
  '/linked-platforms/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const linkedProfiles = await sequelize.query(
        `SELECT platform, profile_url FROM coding_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: req.params.studentId }, type: QueryTypes.SELECT }
      );

      const ratingSupported = linkedProfiles.filter(p =>
        SUPPORTED_PLATFORMS.includes(p.platform.toUpperCase())
      );

      res.json({
        total: linkedProfiles.length,
        ratingSupported: ratingSupported.map(p => ({
          platform: p.platform,
          profileUrl: p.profile_url,
        })),
        unsupported: linkedProfiles
          .filter(p => !SUPPORTED_PLATFORMS.includes(p.platform.toUpperCase()))
          .map(p => p.platform),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/evidence/cp-rating/:id — get single evidence by ID
router.get(
  '/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CPRatingEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }
      res.json(evidence.toJSON());
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/evidence/cp-rating/:id
router.delete(
  '/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CPRatingEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }
      await evidence.destroy();
      res.json({ message: 'Evidence deleted' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
