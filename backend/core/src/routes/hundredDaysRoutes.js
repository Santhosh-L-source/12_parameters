/**
 * Hundred Days Training Routes
 *
 * Module: 100 Days Training (15 marks)
 * Scoring: PEP = 5 marks, HOPE_NON_ELITE (HOPE) = 10 marks, HOPE_ELITE = 15 marks, NOT_SELECTED = 0 marks
 * Verification: Mentor verification & direct cohort grading matrix
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
    console.warn('[HUNDRED_DAYS] Failed to update profile total_score:', err.message);
  }
}

/**
 * POST /api/hundred-days/submit
 * Student submits 100 Days Training evidence
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
      .isInt({ min: 2020, max: 2030 }),
    body('selection_letter_url')
      .optional()
      .isString()
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const { training_program, selection_year, selection_letter_url } = req.body;

      const canonicalRoll = await resolveStudentRoll(studentRoll);

      const existing = await sequelize.query(
        `SELECT id, status FROM hundred_days_evidence WHERE LOWER(roll_number) = LOWER(:canonicalRoll)`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE hundred_days_evidence
           SET programme_type = :training_program,
               status = 'PENDING',
               completed_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              training_program
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );

        return res.json({
          success: true,
          message: 'Evidence updated successfully and submitted for mentor review',
          evidence_id: existing[0].id
        });
      }

      const insertResult = await sequelize.query(
        `INSERT INTO hundred_days_evidence
         (roll_number, programme_type, days_completed, total_days, badge_earned, status, completed_at)
         VALUES (:canonicalRoll, :training_program, 100, 100, true, 'PENDING', NOW())
         RETURNING id, roll_number, programme_type, status, completed_at`,
        {
          replacements: {
            canonicalRoll,
            training_program
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      res.status(201).json({
        success: true,
        message: 'Evidence submitted successfully',
        evidence: insertResult[0][0]
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
      const canonicalRoll = await resolveStudentRoll(studentId);

      // Check authorization
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
          programme_type as training_program,
          days_completed,
          total_days,
          badge_earned,
          status,
          evaluated_by_mentor_roll as mentor_id,
          completed_at as verified_at,
          completed_at as submitted_at
         FROM hundred_days_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)`,
        {
          replacements: { canonicalRoll },
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
          e.programme_type as training_program,
          e.days_completed,
          e.total_days,
          e.badge_earned,
          e.status,
          e.completed_at as submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM hundred_days_evidence e
         JOIN students s ON LOWER(e.roll_number) = LOWER(s.roll_number)
         WHERE e.status = 'PENDING'
           AND (
             :mentorRole = 'admin'
             OR :mentorDept = 'ALL'
             OR s.mentor_roll_number = :mentorRoll
             OR (s.mentor_roll_number IS NULL AND s.department = :mentorDept)
           )
         ORDER BY e.completed_at ASC`,
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
      console.error('[HUNDRED_DAYS] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/hundred-days/:id/verify
 * Mentor verifies student evidence
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
        `SELECT roll_number, status, programme_type FROM hundred_days_evidence WHERE id = :id`,
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
      const progType = evidence[0].programme_type || 'NOT_SELECTED';
      const marks = action === 'VERIFIED' ? (PROGRAM_MARKS[progType] || 0) : 0;

      await sequelize.query(
        `UPDATE hundred_days_evidence
         SET status = :status,
             evaluated_by_mentor_roll = :mentorRoll,
             completed_at = NOW()
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
        await sequelize.query(
          `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
           VALUES (:studentRoll, 'hundred_days', :marks, 1, false, NOW())
           ON CONFLICT (roll_number, parameter_id, semester)
           DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
          {
            replacements: {
              studentRoll,
              marks
            },
            type: sequelize.QueryTypes.INSERT
          }
        );

        await updateStudentProfileScore(studentRoll);
      }

      res.json({
        success: true,
        message: `Evidence ${action.toLowerCase()} successfully`,
        action,
        marks
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
      const canonicalRoll = await resolveStudentRoll(studentId);

      // 1. Check scores table first
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
           AND parameter_id IN ('hundred_days', '100_days', '100_days_coding')
         ORDER BY marks DESC LIMIT 1`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (scoreRows && scoreRows.length > 0 && parseFloat(scoreRows[0].marks) >= 0) {
        return res.json({
          success: true,
          student_id: canonicalRoll,
          marks: parseFloat(scoreRows[0].marks),
          max_marks: 15
        });
      }

      // 2. Check hundred_days_evidence
      const evidence = await sequelize.query(
        `SELECT programme_type, status
         FROM hundred_days_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
         LIMIT 1`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let marks = 0;
      let prog = null;
      if (evidence && evidence.length > 0) {
        prog = evidence[0].programme_type;
        if (evidence[0].status === 'VERIFIED') {
          marks = PROGRAM_MARKS[prog] || 0;
        }
      }

      res.json({
        success: true,
        student_id: canonicalRoll,
        marks,
        max_marks: 15,
        program: prog
      });
    } catch (err) {
      console.error('[HUNDRED_DAYS] Calculate marks error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/hundred-days/evaluate
 * Mentor/Admin directly evaluates and allots marks for a single student
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

      const { student_id, training_program } = req.body;
      const canonicalRoll = await resolveStudentRoll(student_id);
      const marks = PROGRAM_MARKS[training_program] || 0;
      const mentorRoll = req.user.roll_number || req.user.id_number || 'MENTOR';

      // 1. Upsert into hundred_days_evidence
      const existing = await sequelize.query(
        `SELECT id FROM hundred_days_evidence WHERE LOWER(roll_number) = LOWER(:canonicalRoll)`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE hundred_days_evidence
           SET programme_type = :training_program,
               days_completed = CASE WHEN :marks > 0 THEN 100 ELSE 0 END,
               total_days = 100,
               badge_earned = (:marks > 0),
               status = CASE WHEN :marks > 0 THEN 'VERIFIED' ELSE 'NOT_SELECTED' END,
               evaluated_by_mentor_roll = :mentorRoll,
               completed_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              training_program,
              marks,
              mentorRoll
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        await sequelize.query(
          `INSERT INTO hundred_days_evidence
           (roll_number, programme_type, days_completed, total_days, badge_earned, status, evaluated_by_mentor_roll, completed_at)
           VALUES (:canonicalRoll, :training_program, CASE WHEN :marks > 0 THEN 100 ELSE 0 END, 100, (:marks > 0), CASE WHEN :marks > 0 THEN 'VERIFIED' ELSE 'NOT_SELECTED' END, :mentorRoll, NOW())`,
          {
            replacements: {
              canonicalRoll,
              training_program,
              marks,
              mentorRoll
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      // 2. Upsert into scores
      await sequelize.query(
        `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
         VALUES (:canonicalRoll, 'hundred_days', :marks, 1, false, NOW())
         ON CONFLICT (roll_number, parameter_id, semester)
         DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
        {
          replacements: {
            canonicalRoll,
            marks
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      // 3. Update profiles total score
      await updateStudentProfileScore(canonicalRoll);

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

    const mentorRoll = req.user.roll_number || req.user.id_number;
    const mentorDept = req.user.department;
    const isMentor = req.user.role === 'mentor';

    let cohortQuery = `
      SELECT 
        s.roll_number as id_number,
        s.roll_number,
        s.register_number,
        s.name,
        s.department,
        s.section,
        s.batch,
        s.year_of_study as mentor_year,
        e.id as evidence_id,
        COALESCE(e.programme_type, 'NOT_SELECTED') as training_program,
        COALESCE(
          sc.marks,
          CASE 
            WHEN e.programme_type = 'HOPE_ELITE' THEN 15
            WHEN e.programme_type = 'HOPE_NON_ELITE' THEN 10
            WHEN e.programme_type = 'PEP' THEN 5
            ELSE 0 
          END,
          0
        )::numeric as marks,
        COALESCE(e.status, CASE WHEN COALESCE(sc.marks, 0) > 0 THEN 'VERIFIED' ELSE 'NOT_SUBMITTED' END) as status,
        e.completed_at as verified_at,
        e.completed_at as submitted_at
      FROM students s
      LEFT JOIN hundred_days_evidence e 
        ON LOWER(TRIM(e.roll_number)) = LOWER(TRIM(s.roll_number)) 
        OR (s.register_number IS NOT NULL AND LOWER(TRIM(e.roll_number)) = LOWER(TRIM(s.register_number)))
      LEFT JOIN scores sc 
        ON (LOWER(TRIM(sc.roll_number)) = LOWER(TRIM(s.roll_number)) OR (s.register_number IS NOT NULL AND LOWER(TRIM(sc.roll_number)) = LOWER(TRIM(s.register_number))))
        AND sc.parameter_id IN ('hundred_days', '100_days', '100_days_coding')
      WHERE 1=1
    `;

    const replacements = { mentorRoll, mentorDept };

    if (isMentor) {
      cohortQuery += ` AND (
        s.mentor_roll_number = :mentorRoll 
        OR (s.mentor_roll_number IS NULL AND s.department = :mentorDept)
        OR :mentorDept = 'ALL'
      )`;
    }

    cohortQuery += ` ORDER BY s.department, s.roll_number`;

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
    const mentorRoll = req.user.roll_number || req.user.id_number || 'MENTOR';

    for (const sId of student_ids) {
      const canonicalRoll = await resolveStudentRoll(sId);

      // 1. Evidence upsert
      const existing = await sequelize.query(
        `SELECT id FROM hundred_days_evidence WHERE LOWER(roll_number) = LOWER(:canonicalRoll)`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE hundred_days_evidence
           SET programme_type = :training_program,
               days_completed = CASE WHEN :marks > 0 THEN 100 ELSE 0 END,
               total_days = 100,
               badge_earned = (:marks > 0),
               status = CASE WHEN :marks > 0 THEN 'VERIFIED' ELSE 'NOT_SELECTED' END,
               evaluated_by_mentor_roll = :mentorRoll,
               completed_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              training_program,
              marks,
              mentorRoll
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        await sequelize.query(
          `INSERT INTO hundred_days_evidence
           (roll_number, programme_type, days_completed, total_days, badge_earned, status, evaluated_by_mentor_roll, completed_at)
           VALUES (:canonicalRoll, :training_program, CASE WHEN :marks > 0 THEN 100 ELSE 0 END, 100, (:marks > 0), CASE WHEN :marks > 0 THEN 'VERIFIED' ELSE 'NOT_SELECTED' END, :mentorRoll, NOW())`,
          {
            replacements: {
              canonicalRoll,
              training_program,
              marks,
              mentorRoll
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      // 2. Scores upsert
      await sequelize.query(
        `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
         VALUES (:canonicalRoll, 'hundred_days', :marks, 1, false, NOW())
         ON CONFLICT (roll_number, parameter_id, semester)
         DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
        {
          replacements: {
            canonicalRoll,
            marks
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      // 3. Update profiles total score
      await updateStudentProfileScore(canonicalRoll);
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
