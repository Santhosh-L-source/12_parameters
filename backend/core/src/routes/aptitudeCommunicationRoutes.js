/**
 * Aptitude & Communication Routes
 *
 * Module: Aptitude & Communication (15/20 marks)
 * APTITUDE: 3/6/9/12/15 based on percentile / score
 * COMMUNICATION: 3/5 based on scorecard/threshold
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
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
    console.warn('[APTITUDE] Failed to update profile total_score:', err.message);
  }
}

function calculateAptitudeMarks(quant = 0, logical = 0, verbal = 0) {
  const avg = (parseFloat(quant) + parseFloat(logical) + parseFloat(verbal)) / 3;
  if (avg >= 90) return 15;
  if (avg >= 80) return 12;
  if (avg >= 70) return 9;
  if (avg >= 60) return 6;
  if (avg > 0) return 3;
  return 0;
}

function calculateCommunicationMarks(level) {
  if (!level) return 0;
  const l = String(level).toUpperCase();
  if (['C2', 'C1', 'EXPERT', 'ADVANCED', 'DISTINCTION'].includes(l)) return 5;
  if (['B2', 'B1', 'INTERMEDIATE', 'PASS'].includes(l)) return 3;
  return 2;
}

/**
 * POST /api/aptitude-communication/submit
 */
router.post('/submit', authenticate, [
  body('quant_score').optional(),
  body('logical_score').optional(),
  body('verbal_score').optional(),
  body('communication_level').optional().isString(),
], validate, async (req, res, next) => {
  try {
    const studentRoll = req.user.roll_number || req.user.id_number;
    const {
      quant_score,
      logical_score,
      verbal_score,
      communication_level,
      assessment_date
    } = req.body;

    const canonicalRoll = await resolveStudentRoll(studentRoll);

    const insertResult = await sequelize.query(
      `INSERT INTO aptitude_communication_evidence
       (roll_number, quant_score, logical_score, verbal_score, communication_level, assessment_date, status)
       VALUES (:canonicalRoll, :quant_score, :logical_score, :verbal_score, :communication_level, :assessment_date, 'PENDING')
       RETURNING id, roll_number, quant_score, logical_score, verbal_score, communication_level, status`,
      {
        replacements: {
          canonicalRoll,
          quant_score: parseFloat(quant_score) || 0,
          logical_score: parseFloat(logical_score) || 0,
          verbal_score: parseFloat(verbal_score) || 0,
          communication_level: communication_level || 'B2',
          assessment_date: assessment_date || new Date()
        },
        type: sequelize.QueryTypes.INSERT
      }
    );

    res.status(201).json({ success: true, evidence: insertResult[0][0] });
  } catch (err) { next(err); }
});

/**
 * GET /api/aptitude-communication/student/:studentId
 */
router.get('/student/:studentId', authenticate, [param('studentId').notEmpty()], validate, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const canonicalRoll = await resolveStudentRoll(studentId);

    const reqRoll = req.user.roll_number || req.user.id_number;
    if (req.user.role !== 'mentor' && req.user.role !== 'admin' && reqRoll.toLowerCase() !== studentId.toLowerCase() && reqRoll.toLowerCase() !== canonicalRoll.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const evidence = await sequelize.query(
      `SELECT * FROM aptitude_communication_evidence WHERE LOWER(roll_number) = LOWER(:canonicalRoll) ORDER BY assessment_date DESC`,
      { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
    );
    res.json({ success: true, evidence: evidence || [] });
  } catch (err) { next(err); }
});

/**
 * GET /api/aptitude-communication/pending
 */
router.get('/pending', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden', message: 'Only mentors can access this endpoint' });
    }

    const mentorDept = req.user.department;
    const mentorRole = req.user.role;
    const mentorRoll = req.user.roll_number || req.user.id_number;

    const evidence = await sequelize.query(
      `SELECT
        e.id,
        e.roll_number as student_id,
        e.quant_score,
        e.logical_score,
        e.verbal_score,
        e.communication_level,
        e.assessment_date,
        e.status,
        s.name as student_name,
        s.department,
        s.register_number
       FROM aptitude_communication_evidence e
       JOIN students s ON LOWER(e.roll_number) = LOWER(s.roll_number)
       WHERE e.status = 'PENDING'
         AND (
           :mentorRole = 'admin'
           OR :mentorDept = 'ALL'
           OR s.mentor_roll_number = :mentorRoll
           OR (s.mentor_roll_number IS NULL AND s.department = :mentorDept)
         )
       ORDER BY e.assessment_date DESC`,
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
    console.error('[APTITUDE] Get pending error:', err.message);
    next(err);
  }
});

/**
 * POST /api/aptitude-communication/:id/verify
 */
router.post('/:id/verify', authenticate, [
  param('id').isUUID(),
  body('action').isIn(['VERIFIED', 'REJECTED']),
], validate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const evidence = await sequelize.query(
      `SELECT * FROM aptitude_communication_evidence WHERE id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (evidence.length === 0) return res.status(404).json({ success: false, error: 'Not found' });

    const studentRoll = evidence[0].roll_number;

    await sequelize.query(
      `UPDATE aptitude_communication_evidence SET status = :status WHERE id = :id`,
      { replacements: { id, status: action }, type: sequelize.QueryTypes.UPDATE }
    );

    if (action === 'VERIFIED') {
      const allEvidence = await sequelize.query(
        `SELECT * FROM aptitude_communication_evidence WHERE LOWER(roll_number) = LOWER(:studentRoll) AND status = 'VERIFIED'`,
        { replacements: { studentRoll }, type: sequelize.QueryTypes.SELECT }
      );
      
      let bestApt = 0;
      let bestComm = 0;
      for (const ev of (allEvidence || [])) {
        const aptM = calculateAptitudeMarks(ev.quant_score, ev.logical_score, ev.verbal_score);
        bestApt = Math.max(bestApt, aptM);
        const commM = calculateCommunicationMarks(ev.communication_level);
        bestComm = Math.max(bestComm, commM);
      }
      const totalMarks = Math.min(20, bestApt + bestComm);

      await sequelize.query(
        `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
         VALUES (:studentRoll, 'aptitude', :totalMarks, 1, false, NOW())
         ON CONFLICT (roll_number, parameter_id, semester)
         DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
        {
          replacements: { studentRoll, totalMarks },
          type: sequelize.QueryTypes.INSERT
        }
      );

      await updateStudentProfileScore(studentRoll);
    }
    res.json({ success: true, action });
  } catch (err) { next(err); }
});

/**
 * GET /api/aptitude-communication/marks/:studentId
 */
router.get('/marks/:studentId', authenticate, [param('studentId').notEmpty()], validate, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const canonicalRoll = await resolveStudentRoll(studentId);

    // 1. Check scores table first
    const scoreRows = await sequelize.query(
      `SELECT marks FROM scores 
       WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
         AND parameter_id IN ('aptitude', 'aptitude_communication', 'aptitude-communication')
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

    // 2. Check evidence if exists
    let allEvidence = [];
    try {
      allEvidence = await sequelize.query(
        `SELECT * FROM aptitude_communication_evidence 
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );
    } catch (e) {
      allEvidence = [];
    }

    let bestApt = 0;
    let bestComm = 0;
    for (const ev of (allEvidence || [])) {
      const aptM = calculateAptitudeMarks(ev.quant_score, ev.logical_score, ev.verbal_score);
      bestApt = Math.max(bestApt, aptM);
      const commM = calculateCommunicationMarks(ev.communication_level);
      bestComm = Math.max(bestComm, commM);
    }
    const finalMarks = Math.min(20, bestApt + bestComm);

    res.json({
      success: true,
      student_id: canonicalRoll,
      marks: finalMarks,
      max_marks: 20,
      aptitude_marks: bestApt,
      communication_marks: bestComm
    });
  } catch (err) { next(err); }
});

module.exports = router;