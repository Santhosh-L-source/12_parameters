/**
 * Competition Achievement Routes
 *
 * Module: Competition Achievement (20 marks)
 * Scoring: Same event → highest round only, sum distinct events, cap 20
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
 * POST /api/competition/submit
 * Submit competition evidence
 */
router.post(
  '/submit',
  authenticate,
  [
    body('event_name').notEmpty().withMessage('event_name is required'),
    body('round_cleared')
      .isIn(ROUNDS)
      .withMessage(`round_cleared must be one of: ${ROUNDS.join(', ')}`),
    body('competition_type').optional({ checkFalsy: true }).isString(),
    body('organizer').optional({ checkFalsy: true }).isString(),
    body('event_date').optional({ checkFalsy: true }),
    body('certificate_url').optional({ checkFalsy: true }).isString(),
    body('proof_url').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const {
        event_name,
        round_cleared,
        competition_type,
        organizer,
        event_date,
        certificate_url,
        proof_url
      } = req.body;

      // distinct_key = event name only (no date)
      const distinct_key = event_name.trim();
      const stage_marks = ROUND_MARKS[round_cleared];

      // Check for duplicate (same student + same event)
      const existing = await sequelize.query(
        `SELECT id, round_cleared, stage_marks FROM competition_evidence
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
          message: `You have already submitted evidence for "${event_name}". To update to a higher round, contact your mentor.`
        });
      }

      // Insert new evidence
      const result = await sequelize.query(
        `INSERT INTO competition_evidence
         (student_id, distinct_key, event_name, round_cleared, stage_marks,
          competition_type, organizer, event_date, certificate_url, proof_url,
          status, verification_source, submitted_at)
         VALUES (:studentId, :distinct_key, :event_name, :round_cleared, :stage_marks,
                 :competition_type, :organizer, :event_date, :certificate_url, :proof_url,
                 'PENDING', 'MENTOR_MANUAL', NOW())
         RETURNING *`,
        {
          replacements: {
            studentId,
            distinct_key,
            event_name: event_name.trim(),
            round_cleared,
            stage_marks,
            competition_type: competition_type || null,
            organizer: organizer || null,
            event_date: event_date || null,
            certificate_url: certificate_url || null,
            proof_url: proof_url || null
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = result[0][0];

      res.status(201).json({
        success: true,
        message: 'Competition evidence submitted successfully',
        evidence: {
          id: evidence.id,
          event_name: evidence.event_name,
          round_cleared: evidence.round_cleared,
          stage_marks: evidence.stage_marks,
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

      if (req.user.roll_number !== studentId && req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only view your own evidence'
        });
      }

      const evidence = await sequelize.query(
        `SELECT * FROM competition_evidence
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
      console.error('[COMPETITION] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/competition/pending
 * Get all pending competition evidence for mentor review (scoped to mentor's department)
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
          e.event_name,
          e.round_cleared,
          e.stage_marks,
          e.competition_type,
          e.organizer,
          e.event_date,
          e.certificate_url,
          e.proof_url,
          e.status,
          e.submitted_at,
          p.name as student_name,
          p.department
         FROM competition_evidence e
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
      const { id } = req.params;
      const { action, rejection_reason } = req.body;

      // Get evidence
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
        `UPDATE competition_evidence
         SET status = :status,
             mentor_id = :mentorId,
             verified_at = NOW(),
             rejection_reason = :rejectionReason
         WHERE id = :id`,
        {
          replacements: {
            id,
            status: action,
            mentorId: null, // TODO: Use actual mentor ID
            rejectionReason: action === 'REJECTED' ? rejection_reason : null
          },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // If verified, recalculate marks
      if (action === 'VERIFIED') {
        // Get all verified evidence for this student
        // Group by distinct_key_normalized, take MAX stage_marks per group
        const result = await sequelize.query(
          `SELECT
            distinct_key_normalized,
            MAX(stage_marks) as max_stage_marks
           FROM competition_evidence
           WHERE student_id = :studentId AND status = 'VERIFIED'
           GROUP BY distinct_key_normalized`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.SELECT
          }
        );

        // Sum across distinct events, cap at 20
        const totalMarks = result.reduce((sum, row) => sum + row.max_stage_marks, 0);
        const finalMarks = Math.min(20, totalMarks);

        // Delete existing score
        await sequelize.query(
          `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'competition'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.DELETE
          }
        );

        // Insert new score
        await sequelize.query(
          `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
           VALUES (:studentId, 'competition', :marks, 1, false, NOW())`,
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
      console.error('[COMPETITION] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/competition/marks/:studentId
 * Calculate marks for a student
 * Logic: Group by event, MAX per event, SUM across events, cap 20
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
         AND parameter_id IN ('competition', 'competitions')
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

      // 2. Check competition_evidence table
      const result = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized, level, position
         FROM competition_evidence
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
        events_count: result ? result.length : 0
      });

    } catch (err) {
      console.error('[COMPETITION] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
