/**
 * Certificate Achievement Routes
 *
 * Module: Certificate Achievement (20 marks)
 * Scoring: Same credential → highest tier only, sum distinct credentials, foundation sub-cap 10, overall cap 20
 * Verification: Platform-assisted (verify_url) or mentor manual
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');
const AnomalyDetectionService = require('../services/anomalyDetectionService');

const router = express.Router();

const ACADEMIC_TIERS = ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const INDUSTRY_TIERS = ['ASSOCIATE', 'PROFESSIONAL', 'EXPERT'];

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
 * POST /api/certificate/submit
 * Submit certificate evidence
 */
router.post(
  '/submit',
  authenticate,
  [
    body('credential_name').notEmpty().withMessage('credential_name is required'),
    body('credential_category')
      .isIn(['ACADEMIC', 'INDUSTRY'])
      .withMessage('credential_category must be ACADEMIC or INDUSTRY'),
    body('tier_level').notEmpty().withMessage('tier_level is required'),
    body('issuing_organization').optional({ checkFalsy: true }).isString(),
    body('issue_date').optional({ checkFalsy: true }),
    body('expiry_date').optional({ checkFalsy: true }),
    body('certificate_url').optional({ checkFalsy: true }).isString(),
    body('verify_url').optional({ checkFalsy: true }).isString(),
    body('credential_id').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const {
        credential_name,
        credential_category,
        tier_level,
        issuing_organization,
        issue_date,
        expiry_date,
        certificate_url,
        verify_url,
        credential_id
      } = req.body;

      // Validate tier based on category
      let tier_marks;
      if (credential_category === 'ACADEMIC') {
        if (!ACADEMIC_TIERS.includes(tier_level)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid tier',
            message: `For ACADEMIC category, tier must be one of: ${ACADEMIC_TIERS.join(', ')}`
          });
        }
        tier_marks = ACADEMIC_MARKS[tier_level];
      } else {
        if (!INDUSTRY_TIERS.includes(tier_level)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid tier',
            message: `For INDUSTRY category, tier must be one of: ${INDUSTRY_TIERS.join(', ')}`
          });
        }
        tier_marks = INDUSTRY_MARKS[tier_level];
      }

      // distinct_key = credential name only (no date, no tier)
      const distinct_key = credential_name.trim();

      // Determine verification source
      const verification_source = verify_url ? 'PLATFORM_PARTIAL' : 'MENTOR_MANUAL';

      // Check for duplicate (same student + same credential)
      const existing = await sequelize.query(
        `SELECT id, tier_level, tier_marks FROM certificate_evidence
         WHERE student_id = :studentId AND distinct_key_normalized = lower(trim(:distinct_key))`,
        {
          replacements: { studentId, distinct_key },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate submission',
          message: `You have already submitted evidence for "${credential_name}". To update to a higher tier, contact your mentor.`
        });
      }

      // Check cross-student duplicate / signature anomaly
      const anomalyCheck = await AnomalyDetectionService.validateSubmission({
        module: 'certificate',
        studentId,
        semester: null,
        payload: {
          credential_id,
          verify_url,
          certificate_url,
          credential_name
        }
      });

      if (!anomalyCheck.allowed) {
        const crit = anomalyCheck.anomalies.find(a => a.severity === 'CRITICAL');
        return res.status(409).json({
          success: false,
          error: 'Integrity violation: Duplicate credential',
          message: crit ? crit.message : 'This credential has already been submitted by another student.',
          anomalies: anomalyCheck.anomalies
        });
      }

      // Insert new evidence
      const result = await sequelize.query(
        `INSERT INTO certificate_evidence
         (student_id, distinct_key, credential_name, credential_category, tier_level, tier_marks,
          issuing_organization, issue_date, expiry_date, certificate_url, verify_url, credential_id,
          status, verification_source, submitted_at)
         VALUES (:studentId, :distinct_key, :credential_name, :credential_category, :tier_level, :tier_marks,
                 :issuing_organization, :issue_date, :expiry_date, :certificate_url, :verify_url, :credential_id,
                 'PENDING', :verification_source, NOW())
         RETURNING *`,
        {
          replacements: {
            studentId,
            distinct_key,
            credential_name: credential_name.trim(),
            credential_category,
            tier_level,
            tier_marks,
            issuing_organization: issuing_organization || null,
            issue_date: issue_date || null,
            expiry_date: expiry_date || null,
            certificate_url: certificate_url || null,
            verify_url: verify_url || null,
            credential_id: credential_id || null,
            verification_source
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = result[0][0];

      res.status(201).json({
        success: true,
        message: 'Certificate evidence submitted successfully',
        evidence: {
          id: evidence.id,
          credential_name: evidence.credential_name,
          credential_category: evidence.credential_category,
          tier_level: evidence.tier_level,
          tier_marks: evidence.tier_marks,
          verification_source: evidence.verification_source,
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

      if (req.user.roll_number !== studentId && req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only view your own evidence'
        });
      }

      const evidence = await sequelize.query(
        `SELECT * FROM certificate_evidence
         WHERE student_id = :studentId
         ORDER BY submitted_at DESC`,
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
      console.error('[CERTIFICATE] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/certificate/pending
 * Get all pending certificate evidence for mentor review (scoped to mentor's department)
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

      const evidence = await sequelize.query(
        `SELECT
          e.id,
          e.student_id,
          e.credential_name,
          e.credential_category,
          e.tier_level,
          e.tier_marks,
          e.verify_url,
          e.credential_id,
          e.is_foundation_level,
          e.issuing_organization,
          e.issue_date,
          e.expiry_date,
          e.certificate_url,
          e.status,
          e.submitted_at,
          p.name as student_name,
          p.department
         FROM certificate_evidence e
         JOIN profiles p ON e.student_id = p.id_number
         WHERE e.status = 'PENDING'
           AND (
             :mentorRole = 'admin'
             OR p.department = :mentorDepartment
           )
         ORDER BY e.submitted_at ASC`,
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
      console.error('[CERTIFICATE] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/certificate/:id/verify
 * Mentor verifies certificate evidence
 * - Sets is_foundation_level flag (mentor/admin decision)
 * - Recalculates marks with foundation sub-cap
 */
router.post(
  '/:id/verify',
  authenticate,
  [
    param('id').isInt().withMessage('id must be an integer'),
    body('action')
      .isIn(['VERIFIED', 'REJECTED'])
      .withMessage('action must be VERIFIED or REJECTED'),
    body('is_foundation_level')
      .optional()
      .isBoolean()
      .withMessage('is_foundation_level must be boolean'),
    body('rejection_reason')
      .if(body('action').equals('REJECTED'))
      .notEmpty()
      .withMessage('rejection_reason is required when rejecting'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { action, is_foundation_level, rejection_reason } = req.body;

      // Get evidence
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
          message: 'Evidence not found'
        });
      }

      if (evidence[0].status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          message: `Evidence is already ${evidence[0].status}`
        });
      }

      // Update status and is_foundation_level flag
      await sequelize.query(
        `UPDATE certificate_evidence
         SET status = :status,
             mentor_id = :mentorId,
             verified_at = NOW(),
             is_foundation_level = :is_foundation_level,
             rejection_reason = :rejectionReason
         WHERE id = :id`,
        {
          replacements: {
            id,
            status: action,
            mentorId: null, // TODO: Use actual mentor ID
            is_foundation_level: is_foundation_level !== undefined ? is_foundation_level : false,
            rejectionReason: action === 'REJECTED' ? rejection_reason : null
          },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // If verified, recalculate marks with foundation sub-cap
      if (action === 'VERIFIED') {
        // Group by distinct_key_normalized (credential name), take MAX tier_marks per credential
        const result = await sequelize.query(
          `SELECT
            distinct_key_normalized,
            MAX(tier_marks) as max_tier_marks,
            BOOL_OR(is_foundation_level) as is_foundation
           FROM certificate_evidence
           WHERE student_id = :studentId AND status = 'VERIFIED'
           GROUP BY distinct_key_normalized`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.SELECT
          }
        );

        // Split into foundation and non-foundation
        const foundationMarks = result
          .filter(r => r.is_foundation)
          .reduce((sum, r) => sum + r.max_tier_marks, 0);

        const nonFoundationMarks = result
          .filter(r => !r.is_foundation)
          .reduce((sum, r) => sum + r.max_tier_marks, 0);

        // Foundation sub-cap at 10
        const cappedFoundationMarks = Math.min(10, foundationMarks);

        // Total marks (foundation capped + non-foundation), overall cap 20
        const totalMarks = cappedFoundationMarks + nonFoundationMarks;
        const finalMarks = Math.min(20, totalMarks);

        // Delete existing score
        await sequelize.query(
          `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'certificate'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.DELETE
          }
        );

        // Insert new score
        await sequelize.query(
          `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
           VALUES (:studentId, 'certificate', :marks, 1, false, NOW())`,
          {
            replacements: {
              studentId: evidence[0].student_id,
              marks: finalMarks
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
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
 * Logic: Group by credential, MAX per credential, sum foundation (cap 10) + non-foundation, overall cap 20
 */
router.get(
  '/marks/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const cleanId = String(studentId).trim();

      // 1. Check scores table first
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE (LOWER(roll_number) = LOWER(:cleanId) OR LOWER(roll_number) IN (
           SELECT LOWER(roll_number) FROM students WHERE LOWER(register_number) = LOWER(:cleanId)
         ))
         AND parameter_id IN ('certificate', 'certificates', 'certifications')
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
          max_marks: 20
        });
      }

      // 2. Check certificate_evidence table
      const result = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized, certificate_name, grade_or_score
         FROM certificate_evidence
         WHERE (LOWER(roll_number) = LOWER(:cleanId) OR LOWER(roll_number) IN (
           SELECT LOWER(roll_number) FROM students WHERE LOWER(register_number) = LOWER(:cleanId)
         )) AND status = 'VERIFIED'`,
        {
          replacements: { cleanId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let totalMarks = 0;
      if (result && result.length > 0) {
        totalMarks = Math.min(20, result.length * 5);
      }

      res.json({
        success: true,
        student_id: cleanId,
        marks: totalMarks,
        max_marks: 20,
        credentials_count: result ? result.length : 0
      });

    } catch (err) {
      console.error('[CERTIFICATE] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
