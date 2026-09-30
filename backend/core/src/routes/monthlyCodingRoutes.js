/**
 * Monthly Coding Assessment Routes
 *
 * Module: Monthly Coding Assessment (20 marks)
 * Scoring: Average percentage across verified monthly assessments
 *   >= 80% → 20 marks
 *   >= 70% → 15 marks
 *   >= 60% → 10 marks
 *   >= 50% → 5 marks
 *   < 50%  → 0 marks
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

function calculateMonthlyCodingMarks(averagePercentage) {
  if (averagePercentage >= 80) return 20;
  if (averagePercentage >= 70) return 15;
  if (averagePercentage >= 60) return 10;
  if (averagePercentage >= 50) return 5;
  return 0;
}

/**
 * POST /api/monthly-coding/submit
 * Submit monthly assessment evidence
 */
router.post(
  '/submit',
  authenticate,
  [
    body('semester').isInt({ min: 1, max: 8 }).withMessage('semester must be between 1 and 8'),
    body('month').notEmpty().withMessage('month is required'),
    body('year').isInt({ min: 2020, max: 2030 }).withMessage('year must be between 2020 and 2030'),
    body('percentage').isFloat({ min: 0, max: 100 }).withMessage('percentage must be between 0 and 100'),
    body('problems_solved').optional().isInt({ min: 0 }),
    body('total_problems').optional().isInt({ min: 0 }),
    body('platform').optional().isString(),
    body('proof_url').optional().isURL(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const {
        semester,
        month,
        year,
        percentage,
        problems_solved = 0,
        total_problems = 0,
        platform,
        proof_url
      } = req.body;

      const distinct_key = `${year}_${month.trim().toUpperCase()}`;

      // Check for duplicate
      const existing = await sequelize.query(
        `SELECT id, status FROM monthly_coding_evidence
         WHERE student_id = :studentId AND distinct_key = :distinct_key`,
        {
          replacements: { studentId, distinct_key },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let evidence;
      let isUpdate = false;

      if (existing.length > 0) {
        isUpdate = true;
        await sequelize.query(
          `UPDATE monthly_coding_evidence
           SET semester = :semester,
               percentage = :percentage,
               problems_solved = :problems_solved,
               total_problems = :total_problems,
               platform = :platform,
               proof_url = :proof_url,
               status = 'PENDING',
               rejection_reason = NULL,
               submitted_at = NOW(),
               updated_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              semester,
              percentage,
              problems_solved,
              total_problems,
              platform: platform || null,
              proof_url: proof_url || null
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );

        evidence = { id: existing[0].id, student_id: studentId, distinct_key, semester, month, year, percentage, status: 'PENDING' };
      } else {
        const result = await sequelize.query(
          `INSERT INTO monthly_coding_evidence
           (student_id, distinct_key, semester, month, year, percentage, problems_solved, total_problems,
            platform, proof_url, status, submitted_at, created_at, updated_at)
           VALUES (:studentId, :distinct_key, :semester, :month, :year, :percentage, :problems_solved, :total_problems,
                   :platform, :proof_url, 'PENDING', NOW(), NOW(), NOW())
           RETURNING *`,
          {
            replacements: {
              studentId,
              distinct_key,
              semester,
              month: month.trim(),
              year,
              percentage,
              problems_solved,
              total_problems,
              platform: platform || null,
              proof_url: proof_url || null
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
        evidence = result[0][0];
      }

      res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: isUpdate
          ? 'Monthly assessment updated and pending review'
          : 'Monthly assessment submitted successfully',
        evidence
      });

    } catch (err) {
      console.error('[MONTHLY_CODING] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/monthly-coding/student/:studentId
 * Get all monthly coding evidence for a student
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
        `SELECT * FROM monthly_coding_evidence
         WHERE student_id = :studentId
         ORDER BY year DESC, month DESC, submitted_at DESC`,
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
      console.error('[MONTHLY_CODING] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/monthly-coding/mentor-assign
 * Allows mentors to directly record/assign monthly coding assessment scores to students
 */
router.post(
  '/mentor-assign',
  authenticate,
  [
    body('student_id').notEmpty().withMessage('Student Roll Number is required'),
    body('semester').optional().isInt({ min: 1, max: 8 }),
    body('month').notEmpty().withMessage('Month is required'),
    body('year').isInt({ min: 2020, max: 2030 }).withMessage('Year is required'),
    body('percentage').isFloat({ min: 0, max: 100 }).withMessage('Percentage must be between 0 and 100'),
    body('problems_solved').optional().isInt({ min: 0 }),
    body('total_problems').optional().isInt({ min: 0 }),
    body('platform').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only mentors or admins can assign scores'
        });
      }

      const {
        student_id,
        semester = 1,
        month,
        year,
        percentage,
        problems_solved = 0,
        total_problems = 0,
        platform = 'Department Monthly Assessment',
      } = req.body;

      const cleanStudentId = String(student_id).trim().toUpperCase();

      // Verify student exists
      const studentProfile = await sequelize.query(
        `SELECT id_number, name, department FROM profiles WHERE UPPER(TRIM(id_number)) = :cleanStudentId`,
        {
          replacements: { cleanStudentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (!studentProfile || studentProfile.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Student not found',
          message: `No student found with Roll Number: ${cleanStudentId}`
        });
      }

      const distinct_key = `${year}_${month.trim().toUpperCase()}`;

      // Check if already exists for this month/year
      const existing = await sequelize.query(
        `SELECT id FROM monthly_coding_evidence
         WHERE student_id = :cleanStudentId AND distinct_key = :distinct_key`,
        {
          replacements: { cleanStudentId, distinct_key },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE monthly_coding_evidence
           SET semester = :semester,
               percentage = :percentage,
               problems_solved = :problems_solved,
               total_problems = :total_problems,
               platform = :platform,
               status = 'VERIFIED',
               mentor_id = :mentorId,
               verified_at = NOW(),
               rejection_reason = NULL,
               updated_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              semester,
              percentage,
              problems_solved,
              total_problems,
              platform,
              mentorId: req.user.roll_number || req.user.id || 'mentor'
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        await sequelize.query(
          `INSERT INTO monthly_coding_evidence
           (student_id, semester, month, year, percentage, problems_solved, total_problems, platform, status, mentor_id, distinct_key, submitted_at, verified_at, created_at, updated_at)
           VALUES
           (:cleanStudentId, :semester, :month, :year, :percentage, :problems_solved, :total_problems, :platform, 'VERIFIED', :mentorId, :distinct_key, NOW(), NOW(), NOW(), NOW())`,
          {
            replacements: {
              cleanStudentId,
              semester,
              month: month.trim(),
              year,
              percentage,
              problems_solved,
              total_problems,
              platform,
              distinct_key,
              mentorId: req.user.roll_number || req.user.id || 'mentor'
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      // Recalculate student marks
      const verifiedList = await sequelize.query(
        `SELECT percentage FROM monthly_coding_evidence
         WHERE student_id = :cleanStudentId AND status = 'VERIFIED'`,
        {
          replacements: { cleanStudentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let finalMarks = 0;
      let avgPercentage = 0;
      if (verifiedList.length > 0) {
        const sum = verifiedList.reduce((acc, row) => acc + parseFloat(row.percentage || 0), 0);
        avgPercentage = +(sum / verifiedList.length).toFixed(2);
        finalMarks = calculateMonthlyCodingMarks(avgPercentage);
      }

      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :cleanStudentId AND parameter = 'monthly_coding'`,
        {
          replacements: { cleanStudentId },
          type: sequelize.QueryTypes.DELETE
        }
      );

      await sequelize.query(
        `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
         VALUES (:cleanStudentId, 'monthly_coding', :marks, :semester, false, NOW())`,
        {
          replacements: {
            cleanStudentId,
            marks: finalMarks,
            semester
          },
          type: sequelize.QueryTypes.INSERT
        }
      );

      return res.json({
        success: true,
        message: `Assessment recorded for ${studentProfile[0].name} (${cleanStudentId}): ${percentage}% (Overall Average: ${avgPercentage}%, Allotted Marks: ${finalMarks}/20)`,
        student_id: cleanStudentId,
        marks: finalMarks,
        average_percentage: avgPercentage
      });

    } catch (err) {
      console.error('[MONTHLY_CODING] Mentor assign error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/monthly-coding/pending
 * Get all pending monthly coding assessments for mentor review (scoped to mentor's department)
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
          e.semester,
          e.month,
          e.year,
          e.percentage,
          e.problems_solved,
          e.total_problems,
          e.platform,
          e.proof_url,
          e.status,
          e.submitted_at,
          p.name as student_name,
          p.department
         FROM monthly_coding_evidence e
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
      console.error('[MONTHLY_CODING] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/monthly-coding/:id/verify
 * Mentor verifies monthly coding evidence
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

      const evidence = await sequelize.query(
        `SELECT * FROM monthly_coding_evidence WHERE id = :id`,
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

      await sequelize.query(
        `UPDATE monthly_coding_evidence
         SET status = :status,
             mentor_id = :mentorId,
             verified_at = NOW(),
             rejection_reason = :rejectionReason,
             updated_at = NOW()
         WHERE id = :id`,
        {
          replacements: {
            id,
            status: action,
            mentorId: req.user.roll_number || req.user.id || null,
            rejectionReason: action === 'REJECTED' ? rejection_reason : null
          },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // If verified, recalculate marks
      if (action === 'VERIFIED') {
        const verifiedList = await sequelize.query(
          `SELECT percentage FROM monthly_coding_evidence
           WHERE student_id = :studentId AND status = 'VERIFIED'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.SELECT
          }
        );

        let finalMarks = 0;
        if (verifiedList.length > 0) {
          const sum = verifiedList.reduce((acc, row) => acc + parseFloat(row.percentage || 0), 0);
          const avg = sum / verifiedList.length;
          finalMarks = calculateMonthlyCodingMarks(avg);
        }

        await sequelize.query(
          `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'monthly_coding'`,
          {
            replacements: { studentId: evidence[0].student_id },
            type: sequelize.QueryTypes.DELETE
          }
        );

        await sequelize.query(
          `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
           VALUES (:studentId, 'monthly_coding', :marks, 1, false, NOW())`,
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
      console.error('[MONTHLY_CODING] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/monthly-coding/marks/:studentId
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

      const verifiedList = await sequelize.query(
        `SELECT percentage FROM monthly_coding_evidence
         WHERE student_id = :studentId AND status = 'VERIFIED'`,
        {
          replacements: { studentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let finalMarks = 0;
      let avgPercentage = 0;
      if (verifiedList.length > 0) {
        const sum = verifiedList.reduce((acc, row) => acc + parseFloat(row.percentage || 0), 0);
        avgPercentage = +(sum / verifiedList.length).toFixed(2);
        finalMarks = calculateMonthlyCodingMarks(avgPercentage);
      }

      res.json({
        success: true,
        student_id: studentId,
        marks: finalMarks,
        max_marks: 20,
        average_percentage: avgPercentage,
        assessments_count: verifiedList.length
      });

    } catch (err) {
      console.error('[MONTHLY_CODING] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
