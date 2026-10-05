/**
 * Hundred Days Training Routes
 *
 * Module: 100 Days Training (15 marks)
 * Scoring: PEP=5, HOPE_NON_ELITE=10, HOPE_ELITE=15
 * One-time lookup - single record per student
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

const TRAINING_PROGRAMS = ['PEP', 'HOPE_NON_ELITE', 'HOPE_ELITE', 'NOT_SELECTED'];

const PROGRAM_MARKS = {
  'HOPE_ELITE': 15,
  'HOPE_NON_ELITE': 10,
  'PEP': 5,
  'NOT_SELECTED': 0
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
 * POST /api/hundred-days/submit
 * Submit 100 Days Training evidence
 *
 * Body:
 * {
 *   "training_program": "HOPE_ELITE",
 *   "selection_year": 2024,
 *   "selection_letter_url": "https://..."
 * }
 */
router.post(
  '/submit',
  authenticate,
  [
    body('training_program')
      .isIn(TRAINING_PROGRAMS)
      .withMessage(`training_program must be one of: ${TRAINING_PROGRAMS.join(', ')}`),
    body('selection_year')
      .optional()
      .isInt({ min: 2020, max: 2030 })
      .withMessage('selection_year must be between 2020-2030'),
    body('selection_letter_url')
      .optional()
      .isURL()
      .withMessage('selection_letter_url must be a valid URL'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const { training_program, selection_year, selection_letter_url } = req.body;

      // Check if student already has a submission
      const existing = await sequelize.query(
        `SELECT id, status FROM hundred_days_evidence WHERE student_id = :studentId`,
        {
          replacements: { studentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate submission',
          message: 'You have already submitted 100 Days Training evidence. Only one submission allowed per student.'
        });
      }

      // Insert new evidence
      const result = await sequelize.query(
        `INSERT INTO hundred_days_evidence
         (student_id, training_program, selection_year, selection_letter_url, status, verification_source, submitted_at)
         VALUES (:studentId, :training_program, :selection_year, :selection_letter_url, 'PENDING', 'MENTOR_MANUAL', NOW())
         RETURNING *`,
        {
          replacements: {
            studentId,
            training_program,
            selection_year: selection_year || null,
            selection_letter_url: selection_letter_url || null
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = result[0][0];

      res.status(201).json({
        success: true,
        message: 'Evidence submitted successfully',
        evidence: {
          id: evidence.id,
          training_program: evidence.training_program,
          selection_year: evidence.selection_year,
          status: evidence.status,
          submitted_at: evidence.submitted_at
        }
      });

    } catch (err) {
      console.error('[HUNDRED_DAYS] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/hundred-days/student/:studentId
 * Get evidence for a specific student
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
          training_program,
          selection_year,
          selection_letter_url,
          status,
          mentor_id,
          verified_at,
          verification_source,
          rejection_reason,
          submitted_at
         FROM hundred_days_evidence
         WHERE student_id = :studentId`,
        {
          replacements: { studentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      res.json({
        success: true,
        evidence: evidence.length > 0 ? evidence[0] : null
      });

    } catch (err) {
      console.error('[HUNDRED_DAYS] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/hundred-days/pending
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
          e.training_program,
          e.selection_year,
          e.selection_letter_url,
          e.status,
          e.submitted_at,
          p.name as student_name,
          p.department
         FROM hundred_days_evidence e
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
      console.error('[HUNDRED_DAYS] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/hundred-days/:id/verify
 * Mentor verifies evidence
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
        `SELECT student_id, status, training_program FROM hundred_days_evidence WHERE id = :id`,
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
        `UPDATE hundred_days_evidence
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

      // If verified, calculate and update scores
      if (action === 'VERIFIED') {
        const marks = PROGRAM_MARKS[evidence[0].training_program] || 0;

        // Delete existing score first
        await sequelize.query(
          `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'hundred_days'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.DELETE
          }
        );

        // Insert new score (use semester = 1 for non-semester-specific parameters)
        await sequelize.query(
          `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
           VALUES (:studentId, 'hundred_days', :marks, 1, false, NOW())`,
          {
            replacements: {
              studentId: evidence[0].student_id,
              marks
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
      console.error('[HUNDRED_DAYS] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/hundred-days/marks/:studentId
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
      const cleanId = String(studentId).trim();

      // 1. Check scores table first
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE (LOWER(roll_number) = LOWER(:cleanId) OR LOWER(roll_number) IN (
           SELECT LOWER(roll_number) FROM students WHERE LOWER(register_number) = LOWER(:cleanId)
         ))
         AND parameter_id IN ('hundred_days', '100_days')
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

      // 2. Check hundred_days_evidence
      const evidence = await sequelize.query(
        `SELECT programme_type, status
         FROM hundred_days_evidence
         WHERE (LOWER(roll_number) = LOWER(:cleanId) OR LOWER(roll_number) IN (
           SELECT LOWER(roll_number) FROM students WHERE LOWER(register_number) = LOWER(:cleanId)
         )) AND status = 'VERIFIED'
         LIMIT 1`,
        {
          replacements: { cleanId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let marks = 0;
      if (evidence && evidence.length > 0) {
        const prog = evidence[0].programme_type;
        marks = prog === 'HOPE_ELITE' ? 15 : (prog === 'HOPE_NON_ELITE' ? 10 : (prog === 'PEP' ? 5 : 0));
      }

      res.json({
        success: true,
        student_id: cleanId,
        marks,
        max_marks: 15,
        program: evidence && evidence.length > 0 ? evidence[0].programme_type : null
      });

    } catch (err) {
      console.error('[HUNDRED_DAYS] Calculate marks error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/hundred-days/evaluate
 * Mentor/Admin directly evaluates and allots marks for a student's 100 Days Training
 */
router.post(
  '/evaluate',
  authenticate,
  [
    body('student_id').notEmpty().withMessage('student_id is required'),
    body('training_program')
      .isIn(TRAINING_PROGRAMS)
      .withMessage(`training_program must be one of: ${TRAINING_PROGRAMS.join(', ')}`),
    body('selection_year').optional().isInt({ min: 2020, max: 2030 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only mentors and administrators can evaluate 100 Days Training marks',
        });
      }

      const { student_id, training_program, selection_year } = req.body;
      const cleanId = String(student_id).trim();
      const marks = PROGRAM_MARKS[training_program] || 0;
      const mentorId = req.user.id_number || req.user.roll_number || 'MENTOR';

      // 1. Upsert into hundred_days_evidence
      const existing = await sequelize.query(
        `SELECT id FROM hundred_days_evidence WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:cleanId))`,
        { replacements: { cleanId }, type: sequelize.QueryTypes.SELECT }
      );

      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE hundred_days_evidence
           SET training_program = :training_program,
               selection_year = :selection_year,
               status = 'VERIFIED',
               mentor_id = :mentorId,
               verified_at = NOW(),
               verification_source = 'MENTOR_MANUAL'
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              training_program,
              selection_year: selection_year || new Date().getFullYear(),
              mentorId
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        await sequelize.query(
          `INSERT INTO hundred_days_evidence
           (student_id, training_program, selection_year, status, mentor_id, verified_at, verification_source, submitted_at)
           VALUES (:cleanId, :training_program, :selection_year, 'VERIFIED', :mentorId, NOW(), 'MENTOR_MANUAL', NOW())
           ON CONFLICT (student_id) DO UPDATE
           SET training_program = EXCLUDED.training_program,
               status = 'VERIFIED',
               mentor_id = EXCLUDED.mentor_id,
               verified_at = NOW(),
               verification_source = 'MENTOR_MANUAL'`,
          {
            replacements: {
              cleanId,
              training_program,
              selection_year: selection_year || new Date().getFullYear(),
              mentorId
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      // 2. Update/upsert master scores record
      const existingScore = await sequelize.query(
        `SELECT id FROM scores WHERE LOWER(TRIM(register_number)) = LOWER(TRIM(:cleanId))`,
        { replacements: { cleanId }, type: sequelize.QueryTypes.SELECT }
      );

      if (existingScore.length > 0) {
        await sequelize.query(
          `UPDATE scores
           SET hundred_days_score = :marks,
               total_score = COALESCE(language_score, 0) + COALESCE(gate_score, 0) + 
                             COALESCE(competition_score, 0) + COALESCE(internship_score, 0) + 
                             COALESCE(certificate_score, 0) + COALESCE(aptitude_score, 0) + 
                             COALESCE(coding_score, 0) + COALESCE(cp_score, 0) + 
                             COALESCE(oss_score, 0) + COALESCE(month_score, 0) + 
                             COALESCE(proj_score, 0) + :marks,
               calculated_at = NOW(),
               updated_at = NOW()
           WHERE LOWER(TRIM(register_number)) = LOWER(TRIM(:cleanId))`,
          { replacements: { cleanId, marks }, type: sequelize.QueryTypes.UPDATE }
        );
      } else {
        await sequelize.query(
          `INSERT INTO scores 
           (register_number, academic_year, hundred_days_score, total_score, calculated_at, created_at, updated_at)
           VALUES (:cleanId, 2026, :marks, :marks, NOW(), NOW(), NOW())
           ON CONFLICT (register_number, academic_year) DO UPDATE
           SET hundred_days_score = EXCLUDED.hundred_days_score,
               total_score = COALESCE(scores.language_score, 0) + COALESCE(scores.gate_score, 0) + 
                             COALESCE(scores.competition_score, 0) + COALESCE(scores.internship_score, 0) + 
                             COALESCE(scores.certificate_score, 0) + COALESCE(scores.aptitude_score, 0) + 
                             COALESCE(scores.coding_score, 0) + COALESCE(scores.cp_score, 0) + 
                             COALESCE(scores.oss_score, 0) + COALESCE(scores.month_score, 0) + 
                             COALESCE(scores.proj_score, 0) + EXCLUDED.hundred_days_score,
               calculated_at = NOW(),
               updated_at = NOW()`,
          { replacements: { cleanId, marks }, type: sequelize.QueryTypes.INSERT }
        );
      }

      res.json({
        success: true,
        message: `100 Days Training evaluated successfully. Allotted: ${marks}/15 marks (${training_program})`,
        marks,
        program: training_program
      });
    } catch (err) {
      console.error('[HUNDRED_DAYS] Evaluate error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/hundred-days/cohort
 * Returns all mentees assigned to the logged-in mentor with their current 100 Days Training marks and tier
 */
router.get('/cohort', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only mentors and administrators can access cohort grading'
      });
    }

    const mentorId = req.user.id_number || req.user.roll_number;
    const mentorDept = req.user.department;

    let cohortQuery = `
      SELECT 
        COALESCE(
          CASE 
            WHEN p.id_number IS NOT NULL AND TRIM(p.id_number) != '' AND NOT (p.id_number ~ '^[0-9]{1,4}$') 
            THEN p.id_number 
            ELSE p.register_number 
          END, 
          p.register_number,
          p.id_number
        ) as id_number,
        p.register_number,
        p.name,
        p.department,
        p.college,
        p.mentor_year,
        e.id as evidence_id,
        COALESCE(e.training_program, 'NOT_SELECTED') as training_program,
        COALESCE(
          s.hundred_days_score,
          s.marks,
          CASE 
            WHEN e.training_program = 'HOPE_ELITE' THEN 15
            WHEN e.training_program = 'HOPE_NON_ELITE' THEN 10
            WHEN e.training_program = 'PEP' THEN 5
            ELSE 0 
          END,
          0
        ) as marks,
        COALESCE(e.status, CASE WHEN COALESCE(s.hundred_days_score, s.marks, 0) > 0 THEN 'VERIFIED' ELSE 'NOT_SUBMITTED' END) as status,
        e.verified_at,
        e.submitted_at
      FROM profiles p
      LEFT JOIN hundred_days_evidence e 
        ON LOWER(TRIM(e.student_id)) = LOWER(TRIM(p.id_number)) 
        OR (p.register_number IS NOT NULL AND LOWER(TRIM(e.student_id)) = LOWER(TRIM(p.register_number)))
      LEFT JOIN scores s 
        ON LOWER(TRIM(s.register_number)) = LOWER(TRIM(p.id_number)) 
        OR (p.register_number IS NOT NULL AND LOWER(TRIM(s.register_number)) = LOWER(TRIM(p.register_number)))
      WHERE p.role = 'student'
    `;

    const replacements = { mentorId, mentorDept };
    if (req.user.role === 'mentor') {
      cohortQuery += ` AND (p.assigned_mentor_id = :mentorId OR (p.assigned_mentor_id IS NULL AND p.department = :mentorDept))`;
    }

    cohortQuery += ` ORDER BY p.department, p.id_number`;

    const students = await sequelize.query(cohortQuery, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      students: students || []
    });
  } catch (err) {
    console.error('[HUNDRED_DAYS] Cohort fetch error:', err.message);
    next(err);
  }
});

/**
 * POST /api/hundred-days/batch-evaluate
 * Bulk evaluate 100 Days Training for multiple students
 */
router.post('/batch-evaluate', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only mentors and administrators can evaluate 100 Days Training marks'
      });
    }

    const { student_ids, training_program } = req.body;
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'student_ids array is required' });
    }
    if (!TRAINING_PROGRAMS.includes(training_program)) {
      return res.status(400).json({ success: false, message: `training_program must be one of: ${TRAINING_PROGRAMS.join(', ')}` });
    }

    const marks = PROGRAM_MARKS[training_program] || 0;
    const mentorId = req.user.id_number || req.user.roll_number || 'MENTOR';

    for (const sId of student_ids) {
      const cleanId = String(sId).trim();
      
      // 1. Evidence upsert
      const existing = await sequelize.query(
        `SELECT id FROM hundred_days_evidence WHERE LOWER(TRIM(student_id)) = LOWER(:cleanId)`,
        { replacements: { cleanId }, type: sequelize.QueryTypes.SELECT }
      );

      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE hundred_days_evidence
           SET training_program = :training_program,
               selection_year = 2026,
               status = 'VERIFIED',
               mentor_id = :mentorId,
               verified_at = NOW(),
               verification_source = 'MENTOR_MANUAL'
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              training_program,
              mentorId
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        await sequelize.query(
          `INSERT INTO hundred_days_evidence
           (student_id, training_program, selection_year, status, mentor_id, verified_at, verification_source, submitted_at)
           VALUES (:cleanId, :training_program, 2026, 'VERIFIED', :mentorId, NOW(), 'MENTOR_MANUAL', NOW())
           ON CONFLICT (student_id) DO UPDATE
           SET training_program = EXCLUDED.training_program,
               status = 'VERIFIED',
               mentor_id = EXCLUDED.mentor_id,
               verified_at = NOW(),
               verification_source = 'MENTOR_MANUAL'`,
          {
            replacements: {
              cleanId,
              training_program,
              mentorId
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      // 2. Scores master row update or insert
      const existingScore = await sequelize.query(
        `SELECT id FROM scores WHERE LOWER(TRIM(register_number)) = LOWER(:cleanId)`,
        { replacements: { cleanId }, type: sequelize.QueryTypes.SELECT }
      );

      if (existingScore.length > 0) {
        await sequelize.query(
          `UPDATE scores
           SET hundred_days_score = :marks,
               total_score = COALESCE(language_score, 0) + COALESCE(gate_score, 0) + 
                             COALESCE(competition_score, 0) + COALESCE(internship_score, 0) + 
                             COALESCE(certificate_score, 0) + COALESCE(aptitude_score, 0) + 
                             COALESCE(coding_score, 0) + COALESCE(cp_score, 0) + 
                             COALESCE(oss_score, 0) + COALESCE(month_score, 0) + 
                             COALESCE(proj_score, 0) + :marks,
               calculated_at = NOW(),
               updated_at = NOW()
           WHERE LOWER(TRIM(register_number)) = LOWER(:cleanId)`,
          { replacements: { cleanId, marks }, type: sequelize.QueryTypes.UPDATE }
        );
      } else {
        await sequelize.query(
          `INSERT INTO scores 
           (register_number, academic_year, hundred_days_score, total_score, calculated_at, created_at, updated_at)
           VALUES (:cleanId, 2026, :marks, :marks, NOW(), NOW(), NOW())
           ON CONFLICT (register_number, academic_year) DO UPDATE
           SET hundred_days_score = EXCLUDED.hundred_days_score,
               total_score = COALESCE(scores.language_score, 0) + COALESCE(scores.gate_score, 0) + 
                             COALESCE(scores.competition_score, 0) + COALESCE(scores.internship_score, 0) + 
                             COALESCE(scores.certificate_score, 0) + COALESCE(scores.aptitude_score, 0) + 
                             COALESCE(scores.coding_score, 0) + COALESCE(scores.cp_score, 0) + 
                             COALESCE(scores.oss_score, 0) + COALESCE(scores.month_score, 0) + 
                             COALESCE(scores.proj_score, 0) + EXCLUDED.hundred_days_score,
               calculated_at = NOW(),
               updated_at = NOW()`,
          { replacements: { cleanId, marks }, type: sequelize.QueryTypes.INSERT }
        );
      }
    }

    res.json({
      success: true,
      message: `Successfully updated ${student_ids.length} student(s) to ${training_program} (${marks} Marks)`,
      marks,
      program: training_program,
      updated_count: student_ids.length
    });
  } catch (err) {
    console.error('[HUNDRED_DAYS] Batch evaluate error:', err.message);
    next(err);
  }
});

module.exports = router;
