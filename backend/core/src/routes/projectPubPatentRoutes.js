const express = require('express');
const { body, param } = require('express-validator');
const ProjectPubPatentEvidence = require('../models/ProjectPubPatentEvidence');
const { calculateAccumulativeScore } = require('../utils/accumulativeScore');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');
const AnomalyDetectionService = require('../services/anomalyDetectionService');

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
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

// POST /api/evidence/project-pub-patent/submit or /
router.post(
  '/',
  authenticate,
  [
    body('semester').isInt({ min: 1, max: 8 }).withMessage('semester must be 1-8'),
    body('achievement_type').optional().isIn(ACHIEVEMENT_TYPES),
    body('achievementType').optional().isIn(ACHIEVEMENT_TYPES),
    body('output_name').optional().notEmpty(),
    body('outputName').optional().notEmpty(),
    body('achievement_stage').optional().notEmpty(),
    body('achievementStage').optional().notEmpty(),
    body('stage_marks').optional().isInt({ min: 1 }),
    body('stageMarks').optional().isInt({ min: 1 }),
    body('proof_url').optional({ checkFalsy: true }).isString(),
    body('proofUrl').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number || req.body.studentId;
      const semester = req.body.semester;
      const achievementType = req.body.achievement_type || req.body.achievementType;
      const outputName = req.body.output_name || req.body.outputName;
      const achievementStage = req.body.achievement_stage || req.body.achievementStage;
      const stageMarks = req.body.stage_marks || req.body.stageMarks;
      const proofUrl = req.body.proof_url || req.body.proofUrl;

      if (!achievementType || !outputName || !achievementStage || !stageMarks || !proofUrl) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      // Check cross-student duplicate / cross-semester reuse anomaly
      const anomalyCheck = await AnomalyDetectionService.validateSubmission({
        module: 'project',
        studentId,
        semester,
        payload: {
          output_name: outputName,
          proof_url: proofUrl,
          achievement_type: achievementType,
          achievement_stage: achievementStage
        }
      });

      if (!anomalyCheck.allowed) {
        const crit = anomalyCheck.anomalies.find(a => a.severity === 'CRITICAL');
        return res.status(409).json({
          success: false,
          error: 'Integrity violation: Duplicate proof URL',
          message: crit ? crit.message : 'This project proof URL has already been submitted by another student.',
          anomalies: anomalyCheck.anomalies
        });
      }

      const distinctKey = outputName.trim();
      const insertResult = await sequelize.query(
        `INSERT INTO project_evidence
         (student_id, semester, achievement_type, output_name, achievement_stage, stage_marks,
          proof_url, status, distinct_key, submitted_at, created_at, updated_at)
         VALUES
         (:studentId, :semester, :achievementType, :outputName, :achievementStage, :stageMarks,
          :proofUrl, 'PENDING', :distinctKey, NOW(), NOW(), NOW())
         RETURNING *`,
        {
          replacements: {
            studentId,
            semester,
            achievementType,
            outputName: outputName.trim(),
            achievementStage,
            stageMarks,
            proofUrl: proofUrl.trim(),
            distinctKey
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = insertResult[0][0];
      res.status(201).json({ success: true, message: 'Evidence submitted successfully', evidence });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError' || err.message?.includes('duplicate key')) {
        return res.status(409).json({ success: false, error: 'Duplicate evidence entry for this student/output/stage combination' });
      }
      next(err);
    }
  }
);

router.post('/submit', authenticate, [
  body('semester').isInt({ min: 1, max: 8 }).withMessage('semester must be 1-8'),
  body('achievement_type').optional().isIn(ACHIEVEMENT_TYPES),
  body('achievementType').optional().isIn(ACHIEVEMENT_TYPES),
  body('output_name').optional().notEmpty(),
  body('outputName').optional().notEmpty(),
  body('achievement_stage').optional().notEmpty(),
  body('achievementStage').optional().notEmpty(),
  body('stage_marks').optional().isInt({ min: 1 }),
  body('stageMarks').optional().isInt({ min: 1 }),
  body('proof_url').optional({ checkFalsy: true }).isString(),
  body('proofUrl').optional({ checkFalsy: true }).isString(),
], validate, async (req, res, next) => {
  try {
    const studentId = req.user.roll_number || req.body.studentId;
    const semester = req.body.semester;
    const achievementType = req.body.achievement_type || req.body.achievementType;
    const outputName = req.body.output_name || req.body.outputName;
    const achievementStage = req.body.achievement_stage || req.body.achievementStage;
    const stageMarks = req.body.stage_marks || req.body.stageMarks;
    const proofUrl = req.body.proof_url || req.body.proofUrl;

    if (!achievementType || !outputName || !achievementStage || !stageMarks || !proofUrl) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check cross-student duplicate / cross-semester reuse anomaly
    const anomalyCheck = await AnomalyDetectionService.validateSubmission({
      module: 'project',
      studentId,
      semester,
      payload: {
        output_name: outputName,
        proof_url: proofUrl,
        achievement_type: achievementType,
        achievement_stage: achievementStage
      }
    });

    if (!anomalyCheck.allowed) {
      const crit = anomalyCheck.anomalies.find(a => a.severity === 'CRITICAL');
      return res.status(409).json({
        success: false,
        error: 'Integrity violation: Duplicate proof URL',
        message: crit ? crit.message : 'This project proof URL has already been submitted by another student.',
        anomalies: anomalyCheck.anomalies
      });
    }

    const distinctKey = outputName.trim();
    const insertResult = await sequelize.query(
      `INSERT INTO project_evidence
       (student_id, semester, achievement_type, output_name, achievement_stage, stage_marks,
        proof_url, status, distinct_key, submitted_at, created_at, updated_at)
       VALUES
       (:studentId, :semester, :achievementType, :outputName, :achievementStage, :stageMarks,
        :proofUrl, 'PENDING', :distinctKey, NOW(), NOW(), NOW())
       RETURNING *`,
      {
        replacements: {
          studentId,
          semester,
          achievementType,
          outputName: outputName.trim(),
          achievementStage,
          stageMarks,
          proofUrl: proofUrl.trim(),
          distinctKey
        },
        type: sequelize.QueryTypes.INSERT
      }
    );

    const evidence = insertResult[0][0];
    res.status(201).json({ success: true, message: 'Evidence submitted successfully', evidence });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError' || err.message?.includes('duplicate key')) {
      return res.status(409).json({ success: false, error: 'Duplicate evidence entry for this student/output/stage combination' });
    }
    next(err);
  }
});

// GET /api/project-pub-patent/student/:studentId — get all evidence for a student
router.get(
  '/student/:studentId',
  authenticate,
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const evidence = await ProjectPubPatentEvidence.findAll({
        where: { studentId: req.params.studentId },
        order: [['createdAt', 'DESC']],
      });
      res.json({ success: true, evidence });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/project-pub-patent/pending — get all pending evidence for mentor review
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
          e.semester,
          e.achievement_type,
          e.output_name,
          e.achievement_stage,
          e.stage_marks,
          e.proof_url,
          e.status,
          e.created_at,
          p.name as student_name,
          p.department
         FROM project_evidence e
         JOIN profiles p ON e.student_id = p.id_number
         WHERE e.status = 'PENDING'
           AND (
             :mentorRole = 'admin'
             OR p.department = :mentorDepartment
           )
         ORDER BY e.created_at ASC`,
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
      console.error('[PROJECT_PUB_PATENT] Get pending error:', err.message);
      next(err);
    }
  }
);

// GET /api/project-pub-patent/marks/:studentId — compute marks
router.get(
  '/marks/:studentId',
  authenticate,
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.params.studentId;
      const cleanId = String(studentId).trim();

      // 1. Check scores table first
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE (LOWER(roll_number) = LOWER(:cleanId) OR LOWER(roll_number) IN (
           SELECT LOWER(roll_number) FROM students WHERE LOWER(register_number) = LOWER(:cleanId)
         ))
         AND parameter_id IN ('project', 'project_pub_patent', 'proj_score')
         ORDER BY marks DESC LIMIT 1`,
        {
          replacements: { cleanId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (scoreRows && scoreRows.length > 0 && parseFloat(scoreRows[0].marks) > 0) {
        return res.json({
          success: true,
          student_id: cleanId,
          marks: parseFloat(scoreRows[0].marks),
          max_marks: MAX_MARKS
        });
      }

      // 2. Check project_evidence
      const evidence = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized, title, type
         FROM project_evidence
         WHERE (LOWER(roll_number) = LOWER(:cleanId) OR LOWER(roll_number) IN (
           SELECT LOWER(roll_number) FROM students WHERE LOWER(register_number) = LOWER(:cleanId)
         )) AND status = 'VERIFIED'`,
        {
          replacements: { cleanId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let marks = 0;
      if (evidence && evidence.length > 0) {
        marks = Math.min(MAX_MARKS, evidence.length * 10);
      }

      res.json({
        success: true,
        student_id: cleanId,
        studentId: cleanId,
        module: 'Project/Publication/Patent',
        maxMarks: MAX_MARKS,
        max_marks: MAX_MARKS,
        marks,
        evidenceCount: evidence ? evidence.length : 0,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/project-pub-patent/:id/verify & POST /:id/verify — mentor verification
const handleVerify = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const evidence = await ProjectPubPatentEvidence.findByPk(req.params.id, { transaction });
    if (!evidence) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }

    const action = req.body.action || (req.body.status === 'VERIFIED' ? 'VERIFIED' : 'REJECTED');
    const mentorId = req.user?.roll_number || req.body.mentorId || 'MENTOR';
    const oldStatus = evidence.status;

    await evidence.update({
      status: action,
      mentorId,
      verifiedAt: new Date(),
    }, { transaction });

    // Update scores table if VERIFIED
    if (action === 'VERIFIED') {
      const allVerified = await ProjectPubPatentEvidence.findAll({
        where: { studentId: evidence.studentId, status: 'VERIFIED' },
        transaction
      });

      const marks = calculateAccumulativeScore(allVerified, 'outputName', MAX_MARKS);

      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'project'`,
        { replacements: { studentId: evidence.studentId }, transaction }
      );

      await sequelize.query(
        `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
         VALUES (:studentId, 'project', :marks, 1, false, NOW())`,
        { replacements: { studentId: evidence.studentId, marks }, transaction }
      );
    }

    await transaction.commit();
    res.json({ success: true, message: `Evidence ${action.toLowerCase()} successfully`, evidence });
  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch (e) {}
    }
    next(err);
  }
};

router.put('/:id/verify', authenticate, [param('id').isInt()], validate, handleVerify);
router.post('/:id/verify', authenticate, [param('id').isInt()], validate, handleVerify);

// GET /api/project-pub-patent/config/stages — return stage config
router.get('/config/stages', (req, res) => {
  res.json({ stages: STAGE_CONFIG, maxMarks: MAX_MARKS });
});

module.exports = router;
