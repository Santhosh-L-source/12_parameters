/**
 * Internship & Startup Routes
 *
 * Module: Internship & Startup (20 marks)
 * Scoring: Same company -> highest stage only, sum across BOTH tracks, cap 20
 * Verification: Single mentor, manual
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

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
    console.warn('[INTERNSHIP] Failed to update profile total_score:', err.message);
  }
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
    body('role').optional({ checkFalsy: true }).isString(),
    body('duration_months').optional(),
    body('monthly_stipend').optional(),
    body('is_startup').optional().isBoolean(),
    body('offer_letter_url').optional({ checkFalsy: true }).isString(),
    body('completion_certificate_url').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      let {
        company_name,
        startup_name,
        role,
        duration_months,
        monthly_stipend,
        is_startup,
        offer_letter_url,
        completion_certificate_url
      } = req.body;

      const entityName = (company_name || startup_name || '').trim();
      if (!entityName) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Company or Startup name is required',
        });
      }

      const canonicalRoll = await resolveStudentRoll(studentRoll);
      const distinctKey = entityName;
      const distinctKeyNorm = distinctKey.toLowerCase().trim();
      const isStartup = Boolean(is_startup || startup_name);

      const existing = await sequelize.query(
        `SELECT id FROM internship_evidence
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
          message: `You have already submitted evidence for "${entityName}". To update, contact your mentor.`
        });
      }

      const insertResult = await sequelize.query(
        `INSERT INTO internship_evidence
         (roll_number, distinct_key, distinct_key_normalized, company_name, role,
          duration_months, monthly_stipend, is_startup, offer_letter_url, completion_certificate_url,
          status, submitted_at)
         VALUES (:canonicalRoll, :distinctKey, :distinctKeyNorm, :entityName, :role,
                 :duration_months, :monthly_stipend, :isStartup, :offer_letter_url, :completion_certificate_url,
                 'PENDING', NOW())
         RETURNING id, roll_number, company_name, role, is_startup, status, submitted_at`,
        {
          replacements: {
            canonicalRoll,
            distinctKey,
            distinctKeyNorm,
            entityName,
            role: role || null,
            duration_months: parseInt(duration_months) || null,
            monthly_stipend: parseFloat(monthly_stipend) || null,
            isStartup,
            offer_letter_url: offer_letter_url || null,
            completion_certificate_url: completion_certificate_url || null
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = insertResult[0][0];

      res.status(201).json({
        success: true,
        message: 'Internship/startup evidence submitted successfully',
        evidence: {
          id: evidence.id,
          company_name: evidence.company_name,
          role: evidence.role,
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
          company_name,
          role,
          duration_months,
          monthly_stipend,
          is_startup,
          offer_letter_url,
          completion_certificate_url,
          status,
          verified_by_mentor_roll as mentor_id,
          verified_at,
          submitted_at
         FROM internship_evidence
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
      console.error('[INTERNSHIP] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/internship/pending
 * Get all pending internship/startup evidence for mentor review
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
          e.company_name,
          e.role,
          e.duration_months,
          e.monthly_stipend,
          e.is_startup,
          e.offer_letter_url,
          e.completion_certificate_url,
          e.status,
          e.submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM internship_evidence e
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
          message: 'Evidence record not found'
        });
      }

      const studentRoll = evidence[0].roll_number;

      await sequelize.query(
        `UPDATE internship_evidence
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
        const verifiedRows = await sequelize.query(
          `SELECT DISTINCT distinct_key_normalized, duration_months, is_startup, monthly_stipend
           FROM internship_evidence
           WHERE LOWER(roll_number) = LOWER(:studentRoll) AND status = 'VERIFIED'`,
          {
            replacements: { studentRoll },
            type: sequelize.QueryTypes.SELECT
          }
        );

        let totalMarks = 0;
        for (const ev of verifiedRows) {
          const dur = parseInt(ev.duration_months) || 1;
          const marks = dur >= 3 ? 20 : (dur >= 1 ? 10 : 5);
          totalMarks += marks;
        }
        const finalMarks = Math.min(20, totalMarks);

        await sequelize.query(
          `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
           VALUES (:studentRoll, 'internship', :finalMarks, 1, false, NOW())
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
      console.error('[INTERNSHIP] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/internship/marks/:studentId
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
           AND parameter_id IN ('internship', 'internships')
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

      // 2. Check internship_evidence table
      const result = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized, duration_months, is_startup
         FROM internship_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let totalMarks = 0;
      if (result && result.length > 0) {
        for (const ev of result) {
          const dur = parseInt(ev.duration_months) || 1;
          totalMarks += (dur >= 3 ? 20 : (dur >= 1 ? 10 : 5));
        }
        totalMarks = Math.min(20, totalMarks);
      }

      res.json({
        success: true,
        student_id: canonicalRoll,
        marks: totalMarks,
        max_marks: 20,
        companies_count: result ? result.length : 0
      });
    } catch (err) {
      console.error('[INTERNSHIP] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
