/**
 * Foreign Language Routes
 *
 * Module: Foreign Language (15 marks)
 * Scoring: A1 = 7, A2 = 12, B1 = 15 (MAX across languages, NOT sum)
 * Verification: Mentor verification & review queue
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
    console.warn('[LANGUAGE] Failed to update profile total_score:', err.message);
  }
}

/**
 * POST /api/language/submit
 * Submit foreign language evidence
 */
router.post(
  '/submit',
  authenticate,
  [
    body('language')
      .notEmpty()
      .withMessage('language is required')
      .custom((value) => {
        if (value && value.toLowerCase().trim() === 'english') {
          throw new Error('English is not accepted as a foreign language');
        }
        return true;
      }),
    body('proficiency_level')
      .optional()
      .isIn(PROFICIENCY_LEVELS),
    body('certification_level')
      .optional()
      .isIn(PROFICIENCY_LEVELS),
    body('certificate_url')
      .optional({ checkFalsy: true })
      .isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const language = (req.body.language || '').trim();
      const level = req.body.certification_level || req.body.proficiency_level || 'A1';
      const certificateUrl = req.body.certificate_url || req.body.certificateUrl || null;

      if (!PROFICIENCY_LEVELS.includes(level)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid level',
          message: `Level must be one of: ${PROFICIENCY_LEVELS.join(', ')}`
        });
      }

      const canonicalRoll = await resolveStudentRoll(studentRoll);
      const distinctKey = `${language}_${level}`;
      const distinctKeyNorm = distinctKey.toLowerCase().trim();

      const existing = await sequelize.query(
        `SELECT id FROM language_evidence
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
          message: `You have already submitted evidence for ${language} at ${level} level`
        });
      }

      const insertResult = await sequelize.query(
        `INSERT INTO language_evidence
         (roll_number, distinct_key, distinct_key_normalized, language, certification_level, certificate_url, status, submitted_at)
         VALUES (:canonicalRoll, :distinctKey, :distinctKeyNorm, :language, :level, :certificateUrl, 'PENDING', NOW())
         RETURNING id, roll_number, language, certification_level, status, submitted_at`,
        {
          replacements: {
            canonicalRoll,
            distinctKey,
            distinctKeyNorm,
            language,
            level,
            certificateUrl
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = insertResult[0][0];

      res.status(201).json({
        success: true,
        message: 'Language evidence submitted successfully',
        evidence: {
          id: evidence.id,
          language: evidence.language,
          proficiency_level: evidence.certification_level,
          status: evidence.status,
          submitted_at: evidence.submitted_at
        }
      });
    } catch (err) {
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
          language,
          certification_level as proficiency_level,
          certificate_url,
          status,
          verified_by_mentor_roll as mentor_id,
          verified_at,
          submitted_at
         FROM language_evidence
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
          e.language,
          e.certification_level as proficiency_level,
          e.certificate_url,
          e.status,
          e.submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM language_evidence e
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
      console.error('[LANGUAGE] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/language/:id/verify
 * Mentor verifies language evidence
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
        `SELECT roll_number, status, certification_level, language FROM language_evidence WHERE id = :id`,
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
        `UPDATE language_evidence
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
        // Calculate max marks across all verified non-English languages
        const allVerified = await sequelize.query(
          `SELECT certification_level
           FROM language_evidence
           WHERE LOWER(roll_number) = LOWER(:studentRoll)
             AND status = 'VERIFIED'
             AND LOWER(TRIM(language)) != 'english'`,
          {
            replacements: { studentRoll },
            type: sequelize.QueryTypes.SELECT
          }
        );

        let maxMarks = 0;
        for (const ev of allVerified) {
          maxMarks = Math.max(maxMarks, LEVEL_MARKS[ev.certification_level] || 0);
        }

        await sequelize.query(
          `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
           VALUES (:studentRoll, 'language', :maxMarks, 1, false, NOW())
           ON CONFLICT (roll_number, parameter_id, semester)
           DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
          {
            replacements: {
              studentRoll,
              maxMarks
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
      const canonicalRoll = await resolveStudentRoll(studentId);

      // 1. Check scores table first
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
           AND parameter_id IN ('language', 'foreign_language')
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
          max_marks: 15
        });
      }

      // 2. Check language_evidence table
      const evidence = await sequelize.query(
        `SELECT certification_level
         FROM language_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
           AND status = 'VERIFIED'
           AND LOWER(TRIM(language)) != 'english'`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let maxMarks = 0;
      for (const ev of evidence) {
        maxMarks = Math.max(maxMarks, LEVEL_MARKS[ev.certification_level] || 0);
      }

      res.json({
        success: true,
        student_id: canonicalRoll,
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
