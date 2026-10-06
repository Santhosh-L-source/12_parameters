/**
 * Competition Achievement Routes
 *
 * Module: Competition Achievement (20 marks)
 * Scoring: Same event -> highest round only, sum distinct events, cap 20
 * Verification: Single mentor, manual
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

const ROUNDS = [
  'VALID_COMPLETION',
  'PRELIM',
  'SECOND_ROUND',
  'REGIONAL_FINALIST',
  'NATIONAL_FINALIST',
  'INTERNATIONAL_WINNER'
];

const ROUND_MARKS = {
  'VALID_COMPLETION': 2,
  'PRELIM': 4,
  'SECOND_ROUND': 6,
  'REGIONAL_FINALIST': 10,
  'NATIONAL_FINALIST': 15,
  'INTERNATIONAL_WINNER': 20
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
    console.warn('[COMPETITION] Failed to update profile total_score:', err.message);
  }
}

/**
 * POST /api/competition/submit
 * Submit competition evidence
 */
router.post(
  '/submit',
  authenticate,
  [
    body('event_name').optional().isString(),
    body('competition_name').optional().isString(),
    body('round_cleared').optional().isString(),
    body('level').optional().isString(),
    body('position').optional().isString(),
    body('certificate_url').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const eventName = (req.body.competition_name || req.body.event_name || '').trim();
      const level = req.body.level || req.body.round_cleared || 'VALID_COMPLETION';
      const position = req.body.position || 'PARTICIPATION';
      const certificateUrl = req.body.certificate_url || null;

      if (!eventName) {
        return res.status(400).json({ success: false, error: 'competition_name is required' });
      }

      const canonicalRoll = await resolveStudentRoll(studentRoll);
      const distinctKey = eventName;
      const distinctKeyNorm = distinctKey.toLowerCase().trim();

      const existing = await sequelize.query(
        `SELECT id FROM competition_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) 
           AND (distinct_key_normalized = :distinctKeyNorm OR distinct_key = :distinctKey)`,
        {
          replacements: { canonicalRoll, distinctKey, distinctKeyNorm },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (existing.length > 0) {
        const existingId = existing[0].id;
        await sequelize.query(
          `UPDATE competition_evidence
           SET level = COALESCE(:level, level),
               position = COALESCE(:position, position),
               certificate_url = COALESCE(:certificateUrl, certificate_url),
               status = 'PENDING',
               submitted_at = NOW()
           WHERE id = :existingId`,
          {
            replacements: { existingId, level, position, certificateUrl },
            type: sequelize.QueryTypes.UPDATE
          }
        );

        return res.status(200).json({
          success: true,
          message: `Competition evidence for "${eventName}" updated successfully`,
          evidence: {
            id: existingId,
            event_name: eventName,
            round_cleared: level,
            status: 'PENDING',
            submitted_at: new Date()
          }
        });
      }

      const insertResult = await sequelize.query(
        `INSERT INTO competition_evidence
         (roll_number, distinct_key, competition_name, level, position, certificate_url, status, submitted_at)
         VALUES (:canonicalRoll, :distinctKey, :eventName, :level, :position, :certificateUrl, 'PENDING', NOW())
         RETURNING id, roll_number, competition_name, level, position, status, submitted_at`,
        {
          replacements: {
            canonicalRoll,
            distinctKey,
            eventName,
            level,
            position,
            certificateUrl
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = insertResult && Array.isArray(insertResult) && insertResult[0] && Array.isArray(insertResult[0]) 
        ? insertResult[0][0] 
        : (insertResult && insertResult[0] ? insertResult[0] : {});

      res.status(201).json({
        success: true,
        message: 'Competition evidence submitted successfully',
        evidence: {
          id: evidence.id,
          event_name: evidence.competition_name,
          round_cleared: evidence.level,
          status: evidence.status,
          submitted_at: evidence.submitted_at
        }
      });
    } catch (err) {
      console.error('[COMPETITION] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/competition/student/:studentId
 * Get all competition evidence for a student
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
          competition_name as event_name,
          level as round_cleared,
          position,
          certificate_url,
          status,
          verified_by_mentor_roll as mentor_id,
          verified_at,
          submitted_at
         FROM competition_evidence
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
      console.error('[COMPETITION] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/competition/pending
 * Get all pending competition evidence for mentor review
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
          e.competition_name as event_name,
          e.level as round_cleared,
          e.position,
          e.certificate_url,
          e.status,
          e.submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM competition_evidence e
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
      console.error('[COMPETITION] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/competition/:id/verify
 * Mentor verifies competition evidence
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
        `SELECT * FROM competition_evidence WHERE id = :id`,
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
        `UPDATE competition_evidence
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
        const verifiedEvents = await sequelize.query(
          `SELECT DISTINCT distinct_key_normalized, level, position
           FROM competition_evidence
           WHERE LOWER(roll_number) = LOWER(:studentRoll) AND status = 'VERIFIED'`,
          {
            replacements: { studentRoll },
            type: sequelize.QueryTypes.SELECT
          }
        );

        let totalMarks = 0;
        for (const ev of verifiedEvents) {
          const marks = ROUND_MARKS[ev.level] || 5;
          totalMarks += marks;
        }
        const finalMarks = Math.min(20, totalMarks);

        await sequelize.query(
          `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
           VALUES (:studentRoll, 'competition', :finalMarks, 1, false, NOW())
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
      console.error('[COMPETITION] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/competition/marks/:studentId
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
           AND parameter_id IN ('competition', 'competitions')
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

      // 2. Check competition_evidence table
      const result = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized, level, position
         FROM competition_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let totalMarks = 0;
      if (result && result.length > 0) {
        for (const ev of result) {
          totalMarks += (ROUND_MARKS[ev.level] || 5);
        }
        totalMarks = Math.min(20, totalMarks);
      }

      res.json({
        success: true,
        student_id: canonicalRoll,
        marks: totalMarks,
        max_marks: 20,
        events_count: result ? result.length : 0
      });
    } catch (err) {
      console.error('[COMPETITION] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
