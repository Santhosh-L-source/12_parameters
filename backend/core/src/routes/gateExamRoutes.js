/**
 * GATE / Placement Exam Routes
 *
 * Module: GATE / Placement Exam (15/25 marks)
 * Scoring: Core tiers (3/5/10/15/20/25) computed from fields + optional bonus
 * Verification: Single mentor, manual
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

const EXAM_TYPES = ['GATE', 'GRE', 'GMAT', 'CAT', 'TOEFL', 'IELTS', 'PTE'];
const CORE_EXAMS = ['GATE'];
const BONUS_EXAMS = ['GRE', 'GMAT', 'CAT', 'TOEFL', 'IELTS', 'PTE'];

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
    console.warn('[GATE] Failed to update profile total_score:', err.message);
  }
}

/**
 * Calculate core marks from evidence fields
 * Tiers: 3/5/10/15/20/25 (highest match wins, NOT additive)
 */
function calculateCoreMark(evidence, branchThreshold) {
  let coreMarks = 0;

  // Tier 6: Branch-calibrated GATE score (25 marks)
  if (evidence.gate_score && evidence.branch_code && branchThreshold) {
    if (parseFloat(evidence.gate_score) >= branchThreshold) {
      coreMarks = 25;
    }
  }

  // Tier 5: Qualified (20 marks)
  if (coreMarks < 20 && evidence.qualified) {
    coreMarks = 20;
  }

  // Tier 4: Official appearance OR (15+ tests + 3 full-length + 55% avg) (15 marks)
  if (coreMarks < 15) {
    if (evidence.official_appearance) {
      coreMarks = 15;
    } else if (
      (evidence.tests_completed || 0) >= 15 &&
      (evidence.full_length_tests || 0) >= 3 &&
      parseFloat(evidence.average_score_percent || 0) >= 55
    ) {
      coreMarks = 15;
    }
  }

  // Tier 3: 10+ tests + 40% avg (10 marks)
  if (coreMarks < 10 && (evidence.tests_completed || 0) >= 10 && parseFloat(evidence.average_score_percent || 0) >= 40) {
    coreMarks = 10;
  }

  // Tier 2: 5+ tests (5 marks)
  if (coreMarks < 5 && (evidence.tests_completed || 0) >= 5) {
    coreMarks = 5;
  }

  // Tier 1: diagnostic + 3 tests (3 marks)
  if (coreMarks < 3 && evidence.diagnostic_completed && (evidence.tests_completed || 0) >= 3) {
    coreMarks = 3;
  }

  return coreMarks;
}

/**
 * POST /api/gate/submit
 * Submit GATE/placement exam evidence
 */
router.post(
  '/submit',
  authenticate,
  [
    body('exam_type')
      .isIn(EXAM_TYPES)
      .withMessage(`exam_type must be one of: ${EXAM_TYPES.join(', ')}`),
    body('exam_year')
      .optional()
      .isInt({ min: 2020, max: 2030 })
      .withMessage('exam_year must be between 2020-2030'),
    body('tests_completed').optional().isInt({ min: 0 }),
    body('full_length_tests').optional().isInt({ min: 0 }),
    body('average_score_percent').optional(),
    body('diagnostic_completed').optional().isBoolean(),
    body('official_appearance').optional().isBoolean(),
    body('qualified').optional({ checkFalsy: true }).isBoolean(),
    body('gate_score').optional({ checkFalsy: true }),
    body('branch_code').optional({ checkFalsy: true }).isString(),
    body('certificate_url').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const {
        exam_type,
        exam_year,
        tests_completed,
        full_length_tests,
        average_score_percent,
        diagnostic_completed,
        official_appearance,
        qualified,
        gate_score,
        branch_code,
        certificate_url
      } = req.body;

      const canonicalRoll = await resolveStudentRoll(studentRoll);
      const is_bonus_exam = BONUS_EXAMS.includes(exam_type);
      const distinct_key = exam_year ? `${exam_type}_${exam_year}` : exam_type;
      const distinct_key_norm = distinct_key.toLowerCase().trim();

      const existing = await sequelize.query(
        `SELECT id FROM gate_exam_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) 
           AND (distinct_key_normalized = :distinct_key_norm OR distinct_key = :distinct_key)`,
        {
          replacements: { canonicalRoll, distinct_key, distinct_key_norm },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (existing.length > 0) {
        const existingId = existing[0].id;
        await sequelize.query(
          `UPDATE gate_exam_evidence
           SET tests_completed = COALESCE(:tests_completed, tests_completed),
               full_length_tests = COALESCE(:full_length_tests, full_length_tests),
               average_score_percent = COALESCE(:average_score_percent, average_score_percent),
               diagnostic_completed = COALESCE(:diagnostic_completed, diagnostic_completed),
               official_appearance = COALESCE(:official_appearance, official_appearance),
               qualified = COALESCE(:qualified, qualified),
               gate_score = COALESCE(:gate_score, gate_score),
               branch_code = COALESCE(:branch_code, branch_code),
               certificate_url = COALESCE(:certificate_url, certificate_url),
               status = 'PENDING',
               submitted_at = NOW()
           WHERE id = :existingId`,
          {
            replacements: {
              existingId,
              tests_completed: tests_completed || 0,
              full_length_tests: full_length_tests || 0,
              average_score_percent: average_score_percent || null,
              diagnostic_completed: diagnostic_completed || false,
              official_appearance: official_appearance || false,
              qualified: qualified || false,
              gate_score: gate_score || null,
              branch_code: branch_code || null,
              certificate_url: certificate_url || null
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );

        return res.status(200).json({
          success: true,
          message: `Exam evidence for ${exam_type} updated successfully`,
          evidence: {
            id: existingId,
            exam_type,
            status: 'PENDING',
            submitted_at: new Date()
          }
        });
      }

      const insertResult = await sequelize.query(
        `INSERT INTO gate_exam_evidence
         (roll_number, distinct_key, exam_type, exam_year,
          tests_completed, full_length_tests, average_score_percent,
          diagnostic_completed, official_appearance, qualified,
          gate_score, branch_code, is_bonus_exam, certificate_url,
          status, submitted_at)
         VALUES (:canonicalRoll, :distinct_key, :exam_type, :exam_year,
                 :tests_completed, :full_length_tests, :average_score_percent,
                 :diagnostic_completed, :official_appearance, :qualified,
                 :gate_score, :branch_code, :is_bonus_exam, :certificate_url,
                 'PENDING', NOW())
         RETURNING id, roll_number, exam_type, is_bonus_exam, status, submitted_at`,
        {
          replacements: {
            canonicalRoll,
            distinct_key,
            exam_type,
            exam_year: exam_year || null,
            tests_completed: tests_completed || 0,
            full_length_tests: full_length_tests || 0,
            average_score_percent: average_score_percent || null,
            diagnostic_completed: diagnostic_completed || false,
            official_appearance: official_appearance || false,
            qualified: qualified || false,
            gate_score: gate_score || null,
            branch_code: branch_code || null,
            is_bonus_exam,
            certificate_url: certificate_url || null
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidence = insertResult && Array.isArray(insertResult) && insertResult[0] && Array.isArray(insertResult[0]) 
        ? insertResult[0][0] 
        : (insertResult && insertResult[0] ? insertResult[0] : {});

      res.status(201).json({
        success: true,
        message: 'Exam evidence submitted successfully',
        evidence
      });
    } catch (err) {
      console.error('[GATE] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/gate/student/:studentId
 * Get all GATE/exam evidence for a student
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
          exam_type,
          exam_year,
          tests_completed,
          full_length_tests,
          average_score_percent,
          diagnostic_completed,
          official_appearance,
          qualified,
          gate_score,
          branch_code,
          is_bonus_exam,
          certificate_url,
          status,
          verified_by_mentor_roll as mentor_id,
          verified_at,
          submitted_at
         FROM gate_exam_evidence
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
      console.error('[GATE] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/gate/pending
 * Get all pending exam evidence for mentor review
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
          e.exam_type,
          e.exam_year,
          e.tests_completed,
          e.full_length_tests,
          e.average_score_percent,
          e.diagnostic_completed,
          e.official_appearance,
          e.qualified,
          e.gate_score,
          e.branch_code,
          e.is_bonus_exam,
          e.certificate_url,
          e.status,
          e.submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM gate_exam_evidence e
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
      console.error('[GATE] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/gate/:id/verify
 * Mentor verifies GATE exam evidence
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
        `SELECT * FROM gate_exam_evidence WHERE id = :id`,
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
        `UPDATE gate_exam_evidence
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
        const allEvidence = await sequelize.query(
          `SELECT * FROM gate_exam_evidence
           WHERE LOWER(roll_number) = LOWER(:studentRoll) AND status = 'VERIFIED'`,
          {
            replacements: { studentRoll },
            type: sequelize.QueryTypes.SELECT
          }
        );

        let bestCore = 0;
        for (const ev of (allEvidence || [])) {
          if (!ev.is_bonus_exam) {
            let branchThreshold = null;
            if (ev.gate_score && ev.branch_code) {
              try {
                const calibration = await sequelize.query(
                  `SELECT threshold_score FROM gate_branch_calibration
                   WHERE branch = :branch AND year = :year`,
                  {
                    replacements: {
                      branch: ev.branch_code,
                      year: ev.exam_year || new Date().getFullYear()
                    },
                    type: sequelize.QueryTypes.SELECT
                  }
                );
                if (calibration.length > 0) {
                  branchThreshold = parseFloat(calibration[0].threshold_score);
                }
              } catch (calErr) {
                // ignore
              }
            }

            const coreMarks = calculateCoreMark(ev, branchThreshold);
            bestCore = Math.max(bestCore, coreMarks);
          }
        }

        let bonus = 0;
        if (bestCore >= 5) {
          for (const ev of (allEvidence || [])) {
            if (ev.is_bonus_exam) {
              if (['GRE', 'GMAT', 'CAT'].includes(ev.exam_type)) {
                bonus = Math.max(bonus, 3);
              } else if (['TOEFL', 'IELTS', 'PTE'].includes(ev.exam_type)) {
                bonus = Math.max(bonus, 5);
              }
            }
          }
        }

        const finalMarks = Math.min(25, bestCore + bonus);

        await sequelize.query(
          `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
           VALUES (:studentRoll, 'gate', :finalMarks, 1, false, NOW())
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
      console.error('[GATE] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/gate/marks/:studentId
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
           AND parameter_id IN ('gate', 'gate_exam', 'gate_score')
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
          total_marks: parseFloat(scoreRows[0].marks),
          max_marks: 25
        });
      }

      // 2. Check gate_exam_evidence table
      const allEvidence = await sequelize.query(
        `SELECT * FROM gate_exam_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let bestCore = 0;
      for (const ev of (allEvidence || [])) {
        if (!ev.is_bonus_exam) {
          let branchThreshold = null;
          if (ev.gate_score && ev.branch_code) {
            try {
              const calibration = await sequelize.query(
                `SELECT threshold_score FROM gate_branch_calibration
                 WHERE branch = :branch AND year = :year`,
                {
                  replacements: {
                    branch: ev.branch_code,
                    year: ev.exam_year || new Date().getFullYear()
                  },
                  type: sequelize.QueryTypes.SELECT
                }
              );
              if (calibration.length > 0) {
                branchThreshold = parseFloat(calibration[0].threshold_score);
              }
            } catch (calErr) {
              // ignore
            }
          }

          const coreMarks = calculateCoreMark(ev, branchThreshold);
          bestCore = Math.max(bestCore, coreMarks);
        }
      }

      let bonus = 0;
      if (bestCore >= 5) {
        for (const ev of (allEvidence || [])) {
          if (ev.is_bonus_exam) {
            if (['GRE', 'GMAT', 'CAT'].includes(ev.exam_type)) {
              bonus = Math.max(bonus, 3);
            } else if (['TOEFL', 'IELTS', 'PTE'].includes(ev.exam_type)) {
              bonus = Math.max(bonus, 5);
            }
          }
        }
      }

      const finalMarks = Math.min(25, bestCore + bonus);

      res.json({
        success: true,
        student_id: canonicalRoll,
        marks: finalMarks,
        core_marks: bestCore,
        bonus_marks: bonus,
        total_marks: finalMarks,
        max_marks: 25,
        exams_count: allEvidence ? allEvidence.length : 0
      });
    } catch (err) {
      console.error('[GATE] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
