/**
 * Certificate Achievement Routes
 *
 * Module: Certificate Achievement (20 marks)
 * Scoring: Same credential -> highest tier only, sum distinct credentials, foundation sub-cap 10, overall cap 20
 * Verification: Platform-assisted or mentor manual
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

const ACADEMIC_MARKS = {
  'BASIC': 3,
  'INTERMEDIATE': 5,
  'ADVANCED': 10,
  'EXPERT': 15
};

const INDUSTRY_MARKS = {
  'ASSOCIATE': 5,
  'PROFESSIONAL': 10,
  'EXPERT': 15
};

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
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
       updated_at = NOW()
       WHERE LOWER(roll_number) = LOWER(:rollNumber)`,
      {
        replacements: { rollNumber },
        type: sequelize.QueryTypes.UPDATE
      }
    );
  } catch (err) {
    console.warn('[CERTIFICATE] Failed to update profile total_score:', err.message);
  }
}

/**
 * POST /api/certificate/submit
 * Submit certificate evidence
 */
router.post(
  '/submit',
  authenticate,
  [
    body('credential_name').optional().isString(),
    body('certificate_name').optional().isString(),
    body('category').optional().isString(),
    body('credential_category').optional().isString(),
    body('tier_level').optional().isString(),
    body('grade_or_score').optional().isString(),
    body('issuing_body').optional({ checkFalsy: true }).isString(),
    body('issuing_organization').optional({ checkFalsy: true }).isString(),
    body('certificate_url').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const certName = (req.body.certificate_name || req.body.credential_name || '').trim();
      const category = req.body.category || req.body.credential_category || 'INDUSTRY';
      const gradeOrScore = req.body.grade_or_score || req.body.tier_level || 'PROFESSIONAL';
      const issuingBody = req.body.issuing_body || req.body.issuing_organization || null;
      const certificateUrl = req.body.certificate_url || null;

      if (!certName) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Certificate name is required'
        });
      }

      const canonicalRoll = await resolveStudentRoll(studentRoll);
      const distinctKey = certName;
      const distinctKeyNorm = distinctKey.toLowerCase().trim();

      const existing = await sequelize.query(
        `SELECT id FROM certificate_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) 
           AND (distinct_key_normalized = :distinctKeyNorm OR distinct_key = :distinctKey)`,
        {
          replacements: { canonicalRoll, distinctKey, distinctKeyNorm },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate submission',
          message: `You have already submitted evidence for "${certName}". To update, contact your mentor.`
        });
      }

      const insertResult = await sequelize.query(
        `INSERT INTO certificate_evidence
         (roll_number, distinct_key, distinct_key_normalized, certificate_name, category,
          issuing_body, grade_or_score, certificate_url, status, submitted_at)
         VALUES (:canonicalRoll, :distinctKey, :distinctKeyNorm, :certName, :category,
                 :issuingBody, :gradeOrScore, :certificateUrl, 'PENDING', NOW())
         RETURNING id, roll_number, certificate_name, category, grade_or_score, status, submitted_at`,
        {
          replacements: {
            canonicalRoll,
            distinctKey,
            distinctKeyNorm,
            certName,
            category,
            issuingBody,
            gradeOrScore,
            certificateUrl
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = insertResult[0][0];

      res.status(201).json({
        success: true,
        message: 'Certificate evidence submitted successfully',
        evidence: {
          id: evidence.id,
          credential_name: evidence.certificate_name,
          credential_category: evidence.category,
          tier_level: evidence.grade_or_score,
          status: evidence.status,
          submitted_at: evidence.submitted_at
        }
      });
    } catch (err) {
      console.error('[CERTIFICATE] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/certificate/student/:studentId
 * Get all certificate evidence for a student
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
          certificate_name as credential_name,
          category as credential_category,
          grade_or_score as tier_level,
          issuing_body as issuing_organization,
          certificate_url,
          status,
          verified_by_mentor_roll as mentor_id,
          verified_at,
          submitted_at
         FROM certificate_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
         ORDER BY submitted_at DESC`,
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
      console.error('[CERTIFICATE] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/certificate/pending
 * Get all pending certificate evidence for mentor review
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
          message: 'Only mentors and administrators can access pending queue'
        });
      }

      const mentorDept = req.user.department;
      const mentorRole = req.user.role;
      const mentorRoll = req.user.roll_number || req.user.id_number;

      const evidence = await sequelize.query(
        `SELECT
          e.id,
          e.roll_number as student_id,
          e.certificate_name as credential_name,
          e.category as credential_category,
          e.grade_or_score as tier_level,
          e.issuing_body as issuing_organization,
          e.certificate_url,
          e.status,
          e.submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM certificate_evidence e
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
      console.error('[CERTIFICATE] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/certificate/:id/verify
 * Mentor verifies certificate evidence
 */
router.post(
  '/:id/verify',
  authenticate,
  [
    param('id').isUUID().withMessage('id must be a valid UUID'),
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
        `SELECT * FROM certificate_evidence WHERE id = :id`,
        {
          replacements: { id },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (evidence.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Evidence record not found'
        });
      }

      const studentRoll = evidence[0].roll_number;

      await sequelize.query(
        `UPDATE certificate_evidence
         SET status = :status,
             verified_by_mentor_roll = :mentorRoll,
             verified_at = NOW()
         WHERE id = :id`,
        {
          replacements: {
            id,
            status: action,
            mentorRoll
          },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      if (action === 'VERIFIED') {
        const verifiedCerts = await sequelize.query(
          `SELECT DISTINCT distinct_key_normalized, category, grade_or_score
           FROM certificate_evidence
           WHERE LOWER(roll_number) = LOWER(:studentRoll) AND status = 'VERIFIED'`,
          {
            replacements: { studentRoll },
            type: sequelize.QueryTypes.SELECT
          }
        );

        let totalMarks = 0;
        for (const ev of verifiedCerts) {
          const tier = (ev.grade_or_score || '').toUpperCase();
          const marks = INDUSTRY_MARKS[tier] || ACADEMIC_MARKS[tier] || 5;
          totalMarks += marks;
        }
        const finalMarks = Math.min(20, totalMarks);

        await sequelize.query(
          `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
           VALUES (:studentRoll, 'certificate', :finalMarks, 1, false, NOW())
           ON CONFLICT (roll_number, parameter_id, semester)
           DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
          {
            replacements: {
              studentRoll,
              finalMarks
            },
            type: sequelize.QueryTypes.INSERT
          }
        );

        await updateStudentProfileScore(studentRoll);
      }

      res.json({
        success: true,
        message: `Evidence ${action.toLowerCase()} successfully`,
        action
      });
    } catch (err) {
      console.error('[CERTIFICATE] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/certificate/marks/:studentId
 * Calculate marks for a student
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

      // 1. Check scores table first
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
           AND parameter_id IN ('certificate', 'certifications', 'cert_score')
         ORDER BY marks DESC LIMIT 1`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (scoreRows && scoreRows.length > 0 && parseFloat(scoreRows[0].marks) > 0) {
        return res.json({
          success: true,
          student_id: canonicalRoll,
          marks: parseFloat(scoreRows[0].marks),
          max_marks: 20
        });
      }

      // 2. Check certificate_evidence table
      const result = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized, category, grade_or_score
         FROM certificate_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let totalMarks = 0;
      if (result && result.length > 0) {
        for (const ev of result) {
          const tier = (ev.grade_or_score || '').toUpperCase();
          totalMarks += (INDUSTRY_MARKS[tier] || ACADEMIC_MARKS[tier] || 5);
        }
        totalMarks = Math.min(20, totalMarks);
      }

      res.json({
        success: true,
        student_id: canonicalRoll,
        marks: totalMarks,
        max_marks: 20,
        certificates_count: result ? result.length : 0
      });
    } catch (err) {
      console.error('[CERTIFICATE] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
