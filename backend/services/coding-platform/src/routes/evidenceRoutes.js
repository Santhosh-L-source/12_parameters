const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const CodingEvidence = require('../models/CodingEvidence');
const { publishFetchRequested } = require('../kafka/producer');
const { getFetcher, fetcherMap } = require('../fetchers');
const logger = require('../utils/logger');
const { checkHandleMismatch } = require('../utils/handleMatcher');

const router = Router();

const BUILTIN_PLATFORMS = [
  'LEETCODE',
  'CODEFORCES',
  'ATCODER',
  'CODECHEF',
  'HACKERRANK',
  'GEEKSFORGEEKS',
  'SKILLRACK',
];

function isValidPlatform(platform) {
  if (BUILTIN_PLATFORMS.includes(platform)) return true;
  return /^CUSTOM_[A-Z0-9_]+$/.test(platform);
}

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/evidence/coding/fetch — create PENDING row + produce Kafka event
router.post(
  '/fetch',
  [
    body('studentId').notEmpty().withMessage('studentId is required'),
    body('semester').isInt({ min: 1, max: 10 }).withMessage('semester must be 1-10'),
    body('platform').notEmpty().withMessage('platform is required'),
    body('profileUrl').isURL().withMessage('profileUrl must be a valid URL'),
    body('platformLabel').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { studentId, semester, platform, profileUrl, platformLabel } = req.body;

      if (!isValidPlatform(platform)) {
        return res.status(400).json({ error: `Invalid platform key: ${platform}. Custom platforms must use CUSTOM_NAME format.` });
      }

      let evidence = await CodingEvidence.findOne({
        where: { studentId, platform },
      });

      if (evidence) {
        evidence.profileUrl = profileUrl;
        evidence.semester = semester;
        evidence.status = 'PENDING';
        evidence.totalProblemsSolved = 0;
        evidence.sqlProblemsSolved = 0;
        evidence.fetchedAt = null;
        if (platformLabel) evidence.platformLabel = platformLabel;
        await evidence.save();
      } else {
        evidence = await CodingEvidence.create({
          studentId, semester, platform, profileUrl, status: 'PENDING',
          platformLabel: platformLabel || null,
        });
      }

      await publishFetchRequested(evidence);

      res.status(202).json({
        message: 'Fetch requested',
        evidenceId: evidence.id,
        status: evidence.status,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/evidence/coding/fetch-sync — synchronous fetch (no Kafka)
router.post(
  '/fetch-sync',
  [
    body('studentId').notEmpty().withMessage('studentId is required'),
    body('semester').isInt({ min: 1, max: 10 }).withMessage('semester must be 1-10'),
    body('platform').notEmpty().withMessage('platform is required'),
    body('profileUrl').isURL().withMessage('profileUrl must be a valid URL'),
    body('platformLabel').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { studentId, semester, platform, profileUrl, platformLabel } = req.body;

      if (!isValidPlatform(platform)) {
        return res.status(400).json({ error: `Invalid platform key: ${platform}. Custom platforms must use CUSTOM_NAME format.` });
      }

      let evidence = await CodingEvidence.findOne({
        where: { studentId, platform },
      });

      if (evidence) {
        if (evidence.profileUrl !== profileUrl) {
          evidence.verified = false;
          evidence.verifiedAt = null;
          evidence.externalUsername = null;
        }
        evidence.profileUrl = profileUrl;
        evidence.semester = semester;
        evidence.status = 'PENDING';
        if (platformLabel) evidence.platformLabel = platformLabel;
        await evidence.save();
      } else {
        evidence = await CodingEvidence.create({
          studentId, semester, platform, profileUrl, status: 'PENDING',
          platformLabel: platformLabel || null,
        });
      }

      const allRecords = await CodingEvidence.findAll({
        where: { studentId },
      });
      const mismatch = BUILTIN_PLATFORMS.includes(platform)
        ? checkHandleMismatch(platform, profileUrl, allRecords)
        : null;

      const fetcher = getFetcher(platform);
      const result = await fetcher(profileUrl);

      evidence.totalProblemsSolved = result.totalProblemsSolved;
      evidence.sqlProblemsSolved = result.sqlProblemsSolved;
      evidence.fetchedAt = new Date();
      evidence.status = 'APPROVED';
      await evidence.save();

      const isCustom = platform.startsWith('CUSTOM_');
      let msg = mismatch ? mismatch.warning + ' | Fetch completed' : 'Fetch completed';
      if (isCustom && result.totalProblemsSolved === 0) {
        msg += ' (auto-detect found 0 — you can edit counts manually)';
      }

      res.json({
        message: msg,
        warning: mismatch?.warning || null,
        evidence: evidence.toJSON(),
      });
    } catch (error) {
      if (error.message?.includes('Circuit breaker')) {
        return res.status(503).json({ error: 'Service temporarily unavailable', platform: req.body.platform });
      }
      next(error);
    }
  }
);

// GET /api/evidence/coding/:id — poll status
router.get(
  '/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CodingEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }
      res.json(evidence.toJSON());
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/evidence/coding/student/:studentId — get all evidence for a student
router.get(
  '/student/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CodingEvidence.findAll({
        where: { studentId: req.params.studentId },
        order: [['platform', 'ASC']],
      });
      res.json(evidence);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/evidence/coding/marks/:studentId — get marks (only verified platforms count)
router.get(
  '/marks/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CodingEvidence.findAll({
        where: { studentId: req.params.studentId, verified: true },
      });

      const totalSolved = evidence.reduce((s, e) => s + (e.totalProblemsSolved || 0), 0);
      const sqlSolved = evidence.reduce((s, e) => s + (e.sqlProblemsSolved || 0), 0);
      const verifiedPlatforms = evidence.length;

      const CRITERIA = [
        { points: 5, total: 200, sql: 20 },
        { points: 10, total: 350, sql: 30 },
        { points: 15, total: 550, sql: 45 },
        { points: 20, total: 750, sql: 60 },
        { points: 25, total: 1000, sql: 75 },
      ];

      let marks = 0;
      for (const c of CRITERIA) {
        if (totalSolved >= c.total && sqlSolved >= c.sql) {
          marks = c.points;
        }
      }

      res.json({
        marks,
        maxMarks: 25,
        totalSolved,
        sqlSolved,
        verifiedPlatforms,
        breakdown: CRITERIA.map(c => ({
          points: c.points,
          totalRequired: c.total,
          sqlRequired: c.sql,
          achieved: totalSolved >= c.total && sqlSolved >= c.sql,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/evidence/coding/:id/refetch — re-fetch using stored profile URL
router.post(
  '/:id/refetch',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CodingEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }

      const fetcher = getFetcher(evidence.platform);
      const result = await fetcher(evidence.profileUrl);

      evidence.totalProblemsSolved = result.totalProblemsSolved;
      evidence.sqlProblemsSolved = result.sqlProblemsSolved;
      evidence.fetchedAt = new Date();
      await evidence.save();

      res.json({
        message: 'Re-fetch completed',
        evidence: evidence.toJSON(),
      });
    } catch (error) {
      if (error.message?.includes('Circuit breaker')) {
        return res.status(503).json({ error: 'Service temporarily unavailable', platform: 'unknown' });
      }
      next(error);
    }
  }
);

// PUT /api/evidence/coding/:id/update-counts — manual edit of counts
router.put(
  '/:id/update-counts',
  [
    param('id').isInt(),
    body('totalProblemsSolved').optional().isInt({ min: 0 }),
    body('sqlProblemsSolved').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CodingEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }

      if (req.body.totalProblemsSolved !== undefined) {
        evidence.totalProblemsSolved = req.body.totalProblemsSolved;
      }
      if (req.body.sqlProblemsSolved !== undefined) {
        evidence.sqlProblemsSolved = req.body.sqlProblemsSolved;
      }
      await evidence.save();

      res.json({
        message: 'Counts updated',
        evidence: evidence.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/evidence/coding/:id — remove an evidence record
router.delete(
  '/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CodingEvidence.findByPk(req.params.id);
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
