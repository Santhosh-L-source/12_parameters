const express = require('express');
const { body, param, query } = require('express-validator');
const OpensourceEvidence = require('../models/OpensourceEvidence');
const { calculateTotalMarks, MILESTONES, MAX_MARKS } = require('../config/opensourceCriteria');
const { fetchGitHubProfile, analyzeAchievements } = require('../fetchers/githubFetcher');

const router = express.Router();

const ACHIEVEMENT_TYPES = ['MERGED_PR', 'PROGRAMME_SELECTED', 'PROGRAMME_COMPLETED'];

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// POST /api/opensource — add evidence
router.post(
  '/',
  [
    body('studentId').notEmpty().withMessage('studentId is required'),
    body('semester').isInt({ min: 1, max: 8 }).withMessage('semester must be 1-8'),
    body('repoOrProgrammeName').notEmpty().withMessage('repoOrProgrammeName is required'),
    body('achievementType').isIn(ACHIEVEMENT_TYPES).withMessage(`achievementType must be one of: ${ACHIEVEMENT_TYPES.join(', ')}`),
    body('stageMarks').isInt({ min: 1 }).withMessage('stageMarks is required'),
    body('proofUrl').isURL().withMessage('proofUrl must be a valid URL'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await OpensourceEvidence.create(req.body);
      res.status(201).json(evidence);
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Duplicate evidence entry for this student/repo/type combination' });
      }
      next(err);
    }
  }
);

// GET /api/opensource/student/:studentId — get all evidence for a student
router.get(
  '/student/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await OpensourceEvidence.findAll({
        where: { studentId: req.params.studentId },
        order: [['createdAt', 'DESC']],
      });
      res.json(evidence);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/opensource/marks/:studentId — compute marks
router.get(
  '/marks/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await OpensourceEvidence.findAll({
        where: {
          studentId: req.params.studentId,
          status: 'VERIFIED',
        },
      });

      const result = calculateTotalMarks(evidence);

      res.json({
        studentId: req.params.studentId,
        module: 'Open-Source Contribution',
        marks: result.totalMarks,
        maxMarks: MAX_MARKS,
        breakdown: {
          prMarks: result.prMarks,
          programmeMarks: result.programmeMarks,
          mergedPRsCount: result.mergedCount,
        },
        evidenceCount: evidence.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/opensource/:id — get single evidence
router.get(
  '/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await OpensourceEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
      res.json(evidence);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/opensource/:id — update evidence
router.put(
  '/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await OpensourceEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
      await evidence.update(req.body);
      res.json(evidence);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/opensource/:id/verify — mentor verification
router.put(
  '/:id/verify',
  [
    param('id').isInt(),
    body('mentorId').notEmpty().withMessage('mentorId is required'),
    body('status').isIn(['VERIFIED', 'REJECTED']).withMessage('status must be VERIFIED or REJECTED'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await OpensourceEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
      await evidence.update({
        status: req.body.status,
        mentorId: req.body.mentorId,
        verifiedAt: new Date(),
      });
      res.json(evidence);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/opensource/:id
router.delete(
  '/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await OpensourceEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
      await evidence.destroy();
      res.json({ message: 'Deleted' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/opensource/fetch-github/:studentId — fetch GitHub data and auto-create evidence
router.post(
  '/fetch-github/:studentId',
  [
    param('studentId').notEmpty(),
    body('githubUsername').notEmpty().withMessage('githubUsername is required'),
    body('semester').isInt({ min: 1, max: 8 }).withMessage('semester must be 1-8'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const { githubUsername, semester } = req.body;

      // Fetch GitHub profile and stats
      const profileData = await fetchGitHubProfile(githubUsername);

      // Analyze PRs and get summary
      const summary = analyzeAchievements(profileData);

      // Use consistent repo name for finding/updating
      const repoName = `GitHub Contributions`;

      // Create or update single PR summary entry
      const existing = await OpensourceEvidence.findOne({
        where: {
          studentId,
          repoOrProgrammeName: repoName,
          achievementType: 'MERGED_PR',
        },
      });

      let evidence;
      if (existing) {
        // Update existing
        await existing.update({
          merged: summary.mergedPRsCount >= 1,
          validPRsCount: summary.validPRsCount,
          mergedPRsCount: summary.mergedPRsCount,
          platform: 'GitHub',
          stageMarks: summary.marks,
          proofUrl: summary.profileUrl,
          status: 'PENDING',
        });
        evidence = existing;
      } else {
        // Create new
        evidence = await OpensourceEvidence.create({
          studentId,
          semester,
          repoOrProgrammeName: repoName,
          achievementType: 'MERGED_PR',
          merged: summary.mergedPRsCount >= 1,
          validPRsCount: summary.validPRsCount,
          mergedPRsCount: summary.mergedPRsCount,
          platform: 'GitHub',
          stageMarks: summary.marks,
          proofUrl: summary.profileUrl,
          status: 'PENDING',
        });
      }

      res.json({
        message: `Fetched GitHub data for ${githubUsername}`,
        username: profileData.username,
        stats: {
          publicRepos: profileData.publicRepos,
          totalStars: profileData.totalStars,
          followers: profileData.followers,
        },
        prSummary: {
          platform: 'GitHub',
          validPRs: summary.validPRsCount,
          mergedPRs: summary.mergedPRsCount,
          marks: summary.marks,
        },
        externalPRs: summary.externalPRs.slice(0, 10),
        evidenceId: evidence.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/opensource/config/milestones — return milestone config
router.get('/config/milestones', (req, res) => {
  res.json({ milestones: MILESTONES, maxMarks: MAX_MARKS });
});

module.exports = router;
