const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const InternshipStartupEvidence = require('../models/InternshipStartupEvidence');
const { VALID_TRACKS, getStagesForTrack } = require('../config/stages');
const calculateAccumulativeScore = require('../utils/calculateAccumulativeScore');

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  '/submit',
  [
    body('studentId').notEmpty().withMessage('studentId is required'),
    body('semester').isInt({ min: 1, max: 8 }).withMessage('semester must be 1-8'),
    body('track').isIn(VALID_TRACKS).withMessage(`track must be one of: ${VALID_TRACKS.join(', ')}`),
    body('processOrStartupName').notEmpty().withMessage('processOrStartupName is required'),
    body('achievementStage').notEmpty().withMessage('achievementStage is required'),
    body('proofUrl').isURL().withMessage('proofUrl must be a valid URL'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { studentId, semester, track, processOrStartupName, achievementStage, proofUrl } = req.body;

      const stages = getStagesForTrack(track);
      if (!stages[achievementStage]) {
        return res.status(400).json({
          error: `Invalid stage '${achievementStage}' for track '${track}'. Valid: ${Object.keys(stages).join(', ')}`,
        });
      }

      const stageMarks = stages[achievementStage];

      const evidence = await InternshipStartupEvidence.create({
        studentId,
        semester,
        track,
        processOrStartupName,
        achievementStage,
        stageMarks,
        proofUrl,
      });

      res.status(201).json(evidence);
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Duplicate entry for this student + process/startup + stage' });
      }
      next(err);
    }
  }
);

router.get(
  '/student/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const rows = await InternshipStartupEvidence.findAll({
        where: { studentId: req.params.studentId },
        order: [['created_at', 'DESC']],
      });
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/marks/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const approved = await InternshipStartupEvidence.findAll({
        where: { studentId: req.params.studentId, status: 'VERIFIED' },
      });

      const score = calculateAccumulativeScore(approved, 'processOrStartupName', 20);

      res.json({
        studentId: req.params.studentId,
        module: 'D',
        title: 'Internship, Startup & Industry Achievement',
        maxMarks: 20,
        achievedMarks: score,
        approvedCount: approved.length,
        breakdown: approved.map((e) => ({
          track: e.track,
          name: e.processOrStartupName,
          stage: e.achievementStage,
          marks: e.stageMarks,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/approve/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await InternshipStartupEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });

      evidence.status = 'VERIFIED';
      evidence.mentorId = req.body.mentorId || null;
      evidence.verifiedAt = new Date();
      await evidence.save();

      res.json(evidence);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/reject/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await InternshipStartupEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });

      evidence.status = 'REJECTED';
      evidence.mentorId = req.body.mentorId || null;
      await evidence.save();

      res.json(evidence);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await InternshipStartupEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
      if (evidence.status === 'APPROVED') {
        return res.status(400).json({ error: 'Cannot delete approved evidence' });
      }

      await evidence.destroy();
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
