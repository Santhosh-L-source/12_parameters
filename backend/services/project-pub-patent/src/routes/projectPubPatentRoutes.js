const express = require('express');
const { body, param } = require('express-validator');
const ProjectPubPatentEvidence = require('../models/ProjectPubPatentEvidence');
const { calculateAccumulativeScore } = require('../utils/accumulativeScore');
const sequelize = require('../config/database');

const router = express.Router();

const ACHIEVEMENT_TYPES = ['PROJECT', 'PUBLICATION', 'PATENT'];

const STAGE_CONFIG = {
  PROJECT: [
    { stage: 'CONCEPT_DESIGN', marks: 5 },
    { stage: 'WORKING_PROTOTYPE', marks: 10 },
    { stage: 'DEPLOYED_PRODUCT', marks: 15 },
    { stage: 'MONETIZED_OR_FUNDED', marks: 20 },
  ],
  PUBLICATION: [
    { stage: 'CONFERENCE_LOCAL', marks: 5 },
    { stage: 'CONFERENCE_NATIONAL', marks: 10 },
    { stage: 'JOURNAL_INDEXED', marks: 15 },
    { stage: 'JOURNAL_HIGH_IMPACT', marks: 20 },
  ],
  PATENT: [
    { stage: 'FILED', marks: 5 },
    { stage: 'PUBLISHED', marks: 10 },
    { stage: 'GRANTED', marks: 20 },
  ],
};

const MAX_MARKS = 30;

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// POST /api/project-pub-patent — add evidence
router.post(
  '/',
  [
    body('studentId').notEmpty().withMessage('studentId is required'),
    body('semester').isInt({ min: 1, max: 8 }).withMessage('semester must be 1-8'),
    body('achievementType').isIn(ACHIEVEMENT_TYPES).withMessage(`achievementType must be one of: ${ACHIEVEMENT_TYPES.join(', ')}`),
    body('outputName').notEmpty().withMessage('outputName is required'),
    body('achievementStage').notEmpty().withMessage('achievementStage is required'),
    body('stageMarks').isInt({ min: 1 }).withMessage('stageMarks is required'),
    body('proofUrl').isURL().withMessage('proofUrl must be a valid URL'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await ProjectPubPatentEvidence.create(req.body);
      res.status(201).json(evidence);
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Duplicate evidence entry for this student/output/stage combination' });
      }
      next(err);
    }
  }
);

// GET /api/project-pub-patent/student/:studentId — get all evidence for a student
router.get(
  '/student/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await ProjectPubPatentEvidence.findAll({
        where: { studentId: req.params.studentId },
        order: [['createdAt', 'DESC']],
      });
      res.json(evidence);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/project-pub-patent/marks/:studentId — compute marks
router.get(
  '/marks/:studentId',
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await ProjectPubPatentEvidence.findAll({
        where: {
          studentId: req.params.studentId,
          status: 'VERIFIED',
        },
      });

      const marks = calculateAccumulativeScore(evidence, 'outputName', MAX_MARKS);

      res.json({
        studentId: req.params.studentId,
        module: 'Project/Publication/Patent',
        maxMarks: MAX_MARKS,
        marks,
        evidenceCount: evidence.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/project-pub-patent/:id — get single evidence
router.get(
  '/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await ProjectPubPatentEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
      res.json(evidence);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/project-pub-patent/:id — update evidence
router.put(
  '/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await ProjectPubPatentEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
      await evidence.update(req.body);
      res.json(evidence);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/project-pub-patent/:id/verify — mentor verification
router.put(
  '/:id/verify',
  [
    param('id').isInt(),
    body('mentorId').notEmpty().withMessage('mentorId is required'),
    body('status').isIn(['VERIFIED', 'REJECTED']).withMessage('status must be VERIFIED or REJECTED'),
  ],
  validate,
  async (req, res, next) => {
    let transaction;
    try {
      transaction = await sequelize.transaction();

      // Find evidence using transaction
      const evidence = await ProjectPubPatentEvidence.findByPk(req.params.id, { transaction });
      if (!evidence) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Evidence not found' });
      }

      // Capture old status before update
      const oldStatus = evidence.status;

      // Update evidence
      await evidence.update({
        status: req.body.status,
        mentorId: req.body.mentorId,
        verifiedAt: new Date(),
      }, { transaction });

      // Determine audit action
      const action = req.body.status === 'VERIFIED' ? 'APPROVE' : 'REJECT';

      // Insert audit log entry
      await sequelize.query(`
        INSERT INTO audit_log (
          student_id,
          parameter_id,
          actor_id,
          action,
          old_value,
          new_value,
          created_at
        ) VALUES (
          :student_id,
          :parameter_id,
          :actor_id,
          :action,
          :old_value,
          :new_value,
          NOW()
        )
      `, {
        replacements: {
          student_id: evidence.studentId,
          parameter_id: 'project',
          actor_id: req.body.mentorId,
          action: action,
          old_value: JSON.stringify({ status: oldStatus }),
          new_value: JSON.stringify({ status: req.body.status })
        },
        transaction
      });

      // Commit transaction
      await transaction.commit();

      res.json(evidence);
    } catch (err) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError.message);
        }
      }
      next(err);
    }
  }
);

// DELETE /api/project-pub-patent/:id
router.delete(
  '/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await ProjectPubPatentEvidence.findByPk(req.params.id);
      if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
      await evidence.destroy();
      res.json({ message: 'Deleted' });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/project-pub-patent/config/stages — return stage config
router.get('/config/stages', (req, res) => {
  res.json({ stages: STAGE_CONFIG, maxMarks: MAX_MARKS });
});

module.exports = router;
