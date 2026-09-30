const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const path = require('path');
const CompetitionEvidence = require('../models/CompetitionEvidence');
const { STAGES, getMarksForStage, calculateTotalMarks, MAX_MARKS } = require('../config/competitionCriteria');
const upload = require('../config/upload');

const router = Router();

const VALID_STAGE_TYPES = STAGES.map((s) => s.stage);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/competition/submit - with PDF upload
router.post(
  '/submit',
  upload.single('proofFile'),
  [
    body('studentId').notEmpty().withMessage('studentId is required'),
    body('semester').isInt({ min: 1, max: 10 }).withMessage('semester must be 1-10'),
    body('eventName').notEmpty().withMessage('eventName is required'),
    body('stage')
      .isIn(VALID_STAGE_TYPES)
      .withMessage(`stage must be one of: ${VALID_STAGE_TYPES.join(', ')}`),
    body('level').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { studentId, semester, eventName, stage, level } = req.body;
      const stageMarks = getMarksForStage(stage);

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'Proof PDF file is required' });
      }

      // Store relative file path
      const proofUrl = `/uploads/competition/${req.file.filename}`;

      let evidence = await CompetitionEvidence.findOne({
        where: { studentId, eventName, stage },
      });

      if (evidence) {
        // Delete old file if exists
        if (evidence.proofUrl && evidence.proofUrl.startsWith('/uploads/')) {
          const oldFilePath = path.join(__dirname, '../../', evidence.proofUrl);
          const fs = require('fs');
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }

        evidence.semester = semester;
        evidence.level = level;
        evidence.proofUrl = proofUrl;
        evidence.stageMarks = stageMarks;
        evidence.status = 'PENDING';
        evidence.websiteVerified = false;
        evidence.mentorVerified = false;
        await evidence.save();
      } else {
        evidence = await CompetitionEvidence.create({
          studentId,
          semester,
          eventName,
          stage,
          level,
          stageMarks,
          proofUrl,
          status: 'PENDING',
        });
      }

      res.status(201).json({
        message: 'Competition evidence submitted',
        evidence: evidence.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/competition/student/:studentId
router.get(
  '/student/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CompetitionEvidence.findAll({
        where: { studentId: req.params.studentId },
        order: [['event_name', 'ASC']],
      });
      res.json(evidence);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/competition/marks/:studentId
router.get(
  '/marks/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CompetitionEvidence.findAll({
        where: { studentId: req.params.studentId, status: 'VERIFIED' },
      });

      const result = calculateTotalMarks(evidence);

      res.json({
        marks: result.totalMarks,
        maxMarks: MAX_MARKS,
        eventCount: result.eventCount,
        breakdown: result.breakdown,
        approvedEntries: evidence.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/competition/:id/verify-website - Website verification (first stage)
router.put(
  '/:id/verify-website',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CompetitionEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }

      evidence.websiteVerified = true;
      evidence.websiteVerifiedAt = new Date();

      // Check if both verifications are complete
      if (evidence.mentorVerified) {
        evidence.status = 'VERIFIED';
        evidence.verifiedAt = new Date();
      }

      await evidence.save();
      res.json({
        message: 'Website verification completed',
        fullyVerified: evidence.status === 'VERIFIED',
        evidence: evidence.toJSON()
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/competition/:id/verify-mentor - Mentor verification (second stage)
router.put(
  '/:id/verify-mentor',
  [param('id').isInt(), body('mentorId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CompetitionEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }

      evidence.mentorVerified = true;
      evidence.mentorId = req.body.mentorId;

      // Check if both verifications are complete
      if (evidence.websiteVerified) {
        evidence.status = 'VERIFIED';
        evidence.verifiedAt = new Date();
      }

      await evidence.save();
      res.json({
        message: 'Mentor verification completed',
        fullyVerified: evidence.status === 'VERIFIED',
        evidence: evidence.toJSON()
      });
    } catch (error) {
      next(error);
    }
  }
);

// Legacy approve endpoint (kept for backward compatibility)
router.put(
  '/:id/approve',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CompetitionEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }
      // Mark both as verified for legacy support
      evidence.websiteVerified = true;
      evidence.mentorVerified = true;
      evidence.status = 'VERIFIED';
      evidence.verifiedAt = new Date();
      if (req.body.mentorId) evidence.mentorId = req.body.mentorId;
      await evidence.save();
      res.json({ message: 'Evidence approved', evidence: evidence.toJSON() });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/competition/:id/reject
router.put(
  '/:id/reject',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CompetitionEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }
      evidence.status = 'REJECTED';
      if (req.body.mentorId) evidence.mentorId = req.body.mentorId;
      await evidence.save();
      res.json({ message: 'Evidence rejected', evidence: evidence.toJSON() });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/competition/:id
router.delete(
  '/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await CompetitionEvidence.findByPk(req.params.id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }

      // Delete associated file if exists
      if (evidence.proofUrl && evidence.proofUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '../../', evidence.proofUrl);
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await evidence.destroy();
      res.json({ message: 'Evidence deleted' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
