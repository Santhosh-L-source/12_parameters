/**
 * Internship & Startup Routes
 *
 * Module: Internship & Startup (20 marks)
 * Scoring: Same company → highest stage only, sum across BOTH tracks, cap 20 (not 20 per track)
 * Verification: Single mentor, manual
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

const RECRUITMENT_STAGES = [
  'APPLIED',
  'SHORTLISTED',
  'INTERVIEWED',
  'OFFERED',
  'JOINED',
  'COMPLETED'
];

const STARTUP_STAGES = [
  'IDEATION',
  'PROTOTYPE',
  'REGISTERED',
  'FUNDED_SEED',
  'REVENUE',
  'SCALED'
];

const RECRUITMENT_MARKS = {
  'APPLIED': 2,
  'SHORTLISTED': 4,
  'INTERVIEWED': 6,
  'OFFERED': 10,
  'JOINED': 15,
  'COMPLETED': 20
};

const STARTUP_MARKS = {
  'IDEATION': 3,
  'PROTOTYPE': 5,
  'REGISTERED': 8,
  'FUNDED_SEED': 10,
  'REVENUE': 15,
  'SCALED': 20
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
 * POST /api/internship/submit
 * Submit internship/startup evidence
 */
router.post(
  '/submit',
  authenticate,
  [
    body('company_name').optional({ checkFalsy: true }).isString(),
    body('startup_name').optional({ checkFalsy: true }).isString(),
    body('track').optional({ checkFalsy: true }).isString(),
    body('achievement_stage').optional({ checkFalsy: true }).isString(),
    body('recruitment_stage').optional({ checkFalsy: true }).isString(),
    body('startup_stage').optional({ checkFalsy: true }).isString(),
    body('role').optional({ checkFalsy: true }).isString(),
    body('start_date').optional({ checkFalsy: true }),
    body('end_date').optional({ checkFalsy: true }),
    body('duration_months').optional({ checkFalsy: true }),
    body('offer_letter_url').optional({ checkFalsy: true }).isString(),
    body('completion_certificate_url').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      let {
        company_name,
        startup_name,
        track,
        achievement_stage,
        recruitment_stage,
        startup_stage,
        role,
        start_date,
        end_date,
        duration_months,
        offer_letter_url,
        completion_certificate_url
      } = req.body;

      const entityName = company_name || startup_name;
      if (!entityName || !entityName.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Company or Startup name is required',
        });
      }

      const activeTrack = track || (startup_name || startup_stage ? 'STARTUP' : 'RECRUITMENT');
      const activeStage = achievement_stage || recruitment_stage || startup_stage;

      if (!activeStage) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Achievement stage is required',
        });
      }

      // Validate stage based on track
      if (track === 'RECRUITMENT') {
        if (!RECRUITMENT_STAGES.includes(achievement_stage)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid stage',
            message: `For RECRUITMENT track, stage must be one of: ${RECRUITMENT_STAGES.join(', ')}`
          });
        }
      } else {
        if (!STARTUP_STAGES.includes(achievement_stage)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid stage',
            message: `For STARTUP track, stage must be one of: ${STARTUP_STAGES.join(', ')}`
          });
        }
      }

      // Calculate marks
      const stage_marks = track === 'RECRUITMENT'
        ? RECRUITMENT_MARKS[achievement_stage]
        : STARTUP_MARKS[achievement_stage];

      // distinct_key = company name only (no date, no track)
      const distinct_key = company_name.trim();

      // Check for duplicate (same student + same company name)
      const existing = await sequelize.query(
        `SELECT id, track, achievement_stage, stage_marks FROM internship_evidence
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
          message: `You have already submitted evidence for "${company_name}". To update to a higher stage, contact your mentor.`
        });
      }

      // Insert new evidence
      const result = await sequelize.query(
        `INSERT INTO internship_evidence
         (student_id, distinct_key, company_name, track, achievement_stage, stage_marks,
          role, start_date, end_date, duration_months, offer_letter_url, completion_certificate_url,
          status, verification_source, submitted_at)
         VALUES (:studentId, :distinct_key, :company_name, :track, :achievement_stage, :stage_marks,
                 :role, :start_date, :end_date, :duration_months, :offer_letter_url, :completion_certificate_url,
                 'PENDING', 'MENTOR_MANUAL', NOW())
         RETURNING *`,
        {
          replacements: {
            studentId,
            distinct_key,
            company_name: company_name.trim(),
            track,
            achievement_stage,
            stage_marks,
            role: role || null,
            start_date: start_date || null,
            end_date: end_date || null,
            duration_months: duration_months || null,
            offer_letter_url: offer_letter_url || null,
            completion_certificate_url: completion_certificate_url || null
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = result[0][0];

      res.status(201).json({
        success: true,
        message: 'Internship/startup evidence submitted successfully',
        evidence: {
          id: evidence.id,
          company_name: evidence.company_name,
          track: evidence.track,
          achievement_stage: evidence.achievement_stage,
          stage_marks: evidence.stage_marks,
          status: evidence.status,
          submitted_at: evidence.submitted_at
        }
      });

    } catch (err) {
      console.error('[INTERNSHIP] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/internship/student/:studentId
 * Get all internship/startup evidence for a student
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
        `SELECT * FROM internship_evidence
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
      console.error('[INTERNSHIP] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/internship/pending
 * Get all pending internship/startup evidence for mentor review (scoped to mentor's department)
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
          e.company_name,
          e.track,
          e.achievement_stage,
          e.stage_marks,
          e.role,
          e.start_date,
          e.end_date,
          e.duration_months,
          e.offer_letter_url,
          e.completion_certificate_url,
          e.status,
          e.submitted_at,
          p.name as student_name,
          p.department
         FROM internship_evidence e
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
      console.error('[INTERNSHIP] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/internship/:id/verify
 * Mentor verifies internship/startup evidence
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
        `SELECT * FROM internship_evidence WHERE id = :id`,
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
        `UPDATE internship_evidence
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
        // Group by distinct_key_normalized (company name), take MAX stage_marks per company
        // Sum across BOTH tracks, cap at 20
        const result = await sequelize.query(
          `SELECT
            distinct_key_normalized,
            MAX(stage_marks) as max_stage_marks
           FROM internship_evidence
           WHERE student_id = :studentId AND status = 'VERIFIED'
           GROUP BY distinct_key_normalized`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.SELECT
          }
        );

        // Sum across distinct companies, cap at 20
        const totalMarks = result.reduce((sum, row) => sum + row.max_stage_marks, 0);
        const finalMarks = Math.min(20, totalMarks);

        // Delete existing score
        await sequelize.query(
          `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'internship'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.DELETE
          }
        );

        // Insert new score
        await sequelize.query(
          `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
           VALUES (:studentId, 'internship', :marks, 1, false, NOW())`,
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
      console.error('[INTERNSHIP] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/internship/marks/:studentId
 * Calculate marks for a student
 * Logic: Group by company, MAX per company, SUM across both tracks, cap 20
 */
router.get(
  '/marks/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;

      // Group by distinct_key_normalized (company name), take MAX stage_marks per company
      const result = await sequelize.query(
        `SELECT
          distinct_key_normalized,
          MAX(stage_marks) as max_stage_marks,
          MAX(track) as track
         FROM internship_evidence
         WHERE student_id = :studentId AND status = 'VERIFIED'
         GROUP BY distinct_key_normalized`,
        {
          replacements: { studentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      // Sum across distinct companies
      const totalMarks = result.reduce((sum, row) => sum + row.max_stage_marks, 0);
      const finalMarks = Math.min(20, totalMarks);

      res.json({
        success: true,
        student_id: studentId,
        marks: finalMarks,
        max_marks: 20,
        companies_count: result.length,
        uncapped_total: totalMarks,
        breakdown: result
      });

    } catch (err) {
      console.error('[INTERNSHIP] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
