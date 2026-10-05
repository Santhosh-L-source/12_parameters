/**
 * Foreign Language Routes
 *
 * Module: Foreign Language (15 marks)
 * Scoring: A1=7, A2=12, B1=15 (MAX across languages, NOT sum)
 * Verification: Single mentor, manual
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

const PROFICIENCY_LEVELS = ['A1', 'A2', 'B1'];

const LEVEL_MARKS = {
  'A1': 7,
  'A2': 12,
  'B1': 15
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
 * POST /api/language/submit
 * Submit foreign language evidence
 *
 * Body:
 * {
 *   "language": "French",
 *   "proficiency_level": "B1",
 *   "certification_name": "DELF B1",
 *   "certificate_url": "https://..."
 * }
 */
router.post(
  '/submit',
  authenticate,
  [
    body('language')
      .notEmpty()
      .withMessage('language is required')
      .custom((value) => {
        if (value.toLowerCase().trim() === 'english') {
          throw new Error('English is not accepted as a foreign language');
        }
        return true;
      }),
    body('proficiency_level')
      .isIn(PROFICIENCY_LEVELS)
      .withMessage(`proficiency_level must be one of: ${PROFICIENCY_LEVELS.join(', ')}`),
    body('certification_name')
      .optional({ checkFalsy: true })
      .isString(),
    body('certificate_url')
      .optional({ checkFalsy: true })
      .isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const { language, proficiency_level, certification_name, certificate_url } = req.body;

      // Create distinct_key: language + proficiency_level
      const distinct_key = `${language.trim()}_${proficiency_level}`;

      // Check for duplicate
      const existing = await sequelize.query(
        `SELECT id FROM language_evidence
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
          message: `You have already submitted evidence for ${language} at ${proficiency_level} level`
        });
      }

      // Insert new evidence
      const result = await sequelize.query(
        `INSERT INTO language_evidence
         (student_id, distinct_key, language, proficiency_level, certification_name, certificate_url,
          status, verification_source, submitted_at)
         VALUES (:studentId, :distinct_key, :language, :proficiency_level, :certification_name, :certificate_url,
                 'PENDING', 'MENTOR_MANUAL', NOW())
         RETURNING *`,
        {
          replacements: {
            studentId,
            distinct_key,
            language: language.trim(),
            proficiency_level,
            certification_name: certification_name || null,
            certificate_url: certificate_url || null
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = result[0][0];

      res.status(201).json({
        success: true,
        message: 'Language evidence submitted successfully',
        evidence: {
          id: evidence.id,
          language: evidence.language,
          proficiency_level: evidence.proficiency_level,
          status: evidence.status,
          submitted_at: evidence.submitted_at
        }
      });

    } catch (err) {
      if (err.message && err.message.includes('language_evidence_language_check')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid language',
          message: 'English is not accepted as a foreign language'
        });
      }
      console.error('[LANGUAGE] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/language/student/:studentId
 * Get all language evidence for a specific student
 */
router.get(
  '/student/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;

      // Check if requesting own data or if mentor/admin
      if (req.user.roll_number !== studentId && req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only view your own evidence'
        });
      }

      const evidence = await sequelize.query(
        `SELECT
          id,
          student_id,
          language,
          proficiency_level,
          certification_name,
          certificate_url,
          status,
          mentor_id,
          verified_at,
          verification_source,
          rejection_reason,
          submitted_at
         FROM language_evidence
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
      console.error('[LANGUAGE] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/language/pending
 * Get all pending evidence for mentor review
 */
router.get(
  '/pending',
  authenticate,
  async (req, res, next) => {
    try {
      // Require mentor or admin role
      if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only mentors can access this endpoint'
        });
      }

      // Scope to mentor's department (admins see all)
      const evidence = await sequelize.query(
        `SELECT
          e.id,
          e.student_id,
          e.language,
          e.proficiency_level,
          e.certification_name,
          e.certificate_url,
          e.status,
          e.submitted_at,
          p.name as student_name,
          p.department
         FROM language_evidence e
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
      console.error('[LANGUAGE] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/language/:id/verify
 * Mentor verifies language evidence
 *
 * Body:
 * {
 *   "action": "VERIFIED" | "REJECTED",
 *   "rejection_reason": "..." (required if REJECTED)
 * }
 */
router.post(
  '/:id/verify',
  authenticate,
  [
    param('id').isInt().withMessage('id must be an integer'),
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
      // TODO: Add role check - only mentors can verify
      // For now, allowing authenticated users

      const { id } = req.params;
      const { action, rejection_reason } = req.body;

      // Get evidence
      const evidence = await sequelize.query(
        `SELECT student_id, status, proficiency_level FROM language_evidence WHERE id = :id`,
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

      // Update status
      await sequelize.query(
        `UPDATE language_evidence
         SET status = :status,
             mentor_id = :mentorId,
             verified_at = NOW(),
             rejection_reason = :rejectionReason
         WHERE id = :id`,
        {
          replacements: {
            id,
            status: action,
            mentorId: null, // TODO: Use actual mentor ID from req.user
            rejectionReason: action === 'REJECTED' ? rejection_reason : null
          },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // If verified, recalculate marks (MAX across all languages)
      if (action === 'VERIFIED') {
        const allEvidence = await sequelize.query(
          `SELECT proficiency_level
           FROM language_evidence
           WHERE student_id = :studentId
             AND status = 'VERIFIED'
             AND lower(trim(language)) != 'english'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.SELECT
          }
        );

        // Calculate MAX marks
        let maxMarks = 0;
        for (const ev of allEvidence) {
          maxMarks = Math.max(maxMarks, LEVEL_MARKS[ev.proficiency_level] || 0);
        }

        // Delete existing score
        await sequelize.query(
          `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'language'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.DELETE
          }
        );

        // Insert new score
        await sequelize.query(
          `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
           VALUES (:studentId, 'language', :marks, 1, false, NOW())`,
          {
            replacements: {
              studentId: evidence[0].student_id,
              marks: maxMarks
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
      console.error('[LANGUAGE] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/language/marks/:studentId
 * Calculate marks for a student (MAX across all verified languages)
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
         AND parameter_id IN ('language', 'foreign_language')
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
          max_marks: 15
        });
      }

      // 2. Check language_evidence table
      const evidence = await sequelize.query(
        `SELECT certification_level as proficiency_level
         FROM language_evidence
         WHERE (LOWER(roll_number) = LOWER(:cleanId) OR LOWER(roll_number) IN (
           SELECT LOWER(roll_number) FROM students WHERE LOWER(register_number) = LOWER(:cleanId)
         ))
         AND status = 'VERIFIED'
         AND lower(trim(language)) != 'english'`,
        {
          replacements: { cleanId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let maxMarks = 0;
      for (const ev of evidence) {
        maxMarks = Math.max(maxMarks, LEVEL_MARKS[ev.proficiency_level] || 0);
      }

      res.json({
        success: true,
        student_id: cleanId,
        marks: maxMarks,
        max_marks: 15,
        languages_count: evidence ? evidence.length : 0
      });

    } catch (err) {
      console.error('[LANGUAGE] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
