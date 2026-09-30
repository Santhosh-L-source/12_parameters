/**
 * Aptitude & Communication Routes - CORRECTED
 * APTITUDE: 3/6/9/12/15 based on percentile
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

function calculateAptitudeMarks(test_completed, percentile) {
  if (!test_completed) return 0;
  if (!percentile || percentile < 60) return 3;
  if (percentile >= 90) return 15;
  if (percentile >= 80) return 12;
  if (percentile >= 70) return 9;
  if (percentile >= 60) return 6;
  return 3;
}

function calculateCommunicationMarks(has_valid_scorecard, meets_central_threshold) {
  if (meets_central_threshold) return 5;
  if (has_valid_scorecard) return 3;
  return 0;
}

router.post('/submit', authenticate, [
  body('evidence_category').optional({ checkFalsy: true }).isString(),
  body('event_type').optional({ checkFalsy: true }).isString(),
  body('event_name').optional({ checkFalsy: true }).isString(),
  body('certificate_url').optional({ checkFalsy: true }).isString(),
], validate, async (req, res, next) => {
  try {
    const studentId = req.user.roll_number;
    let {
      evidence_category,
      event_type,
      test_completed,
      percentile,
      test_name,
      event_name,
      test_date,
      has_valid_scorecard,
      meets_central_threshold,
      event_description,
      event_date,
      certificate_url,
      remarks,
      aptitude_level,
      communication_level
    } = req.body;

    const category = evidence_category || event_type || (aptitude_level ? 'APTITUDE' : 'COMMUNICATION');
    const name = event_name || test_name || event_description || `${category} Event`;

    // Map achievement levels if provided from student portal
    if (aptitude_level) {
      if (aptitude_level === 'INTERNATIONAL_WINNER') percentile = 95;
      else if (aptitude_level === 'NATIONAL_WINNER') percentile = 85;
      else if (aptitude_level === 'REGIONAL_WINNER') percentile = 75;
      else if (aptitude_level === 'QUALIFIED') percentile = 65;
      else percentile = 50;
      test_completed = true;
    }

    if (communication_level) {
      if (['BEST_SPEAKER', 'WINNER', 'FINALIST'].includes(communication_level)) {
        meets_central_threshold = true;
      } else {
        has_valid_scorecard = true;
      }
    }

    // Prepare category-specific fields (null out non-applicable ones)
    let insertData;
    if (category === 'APTITUDE') {
      insertData = {
        studentId,
        evidence_category: 'APTITUDE',
        percentile: percentile || null,
        test_completed: true,
        test_name: name || null,
        test_date: test_date || event_date || null,
        has_valid_scorecard: false,  // Force FALSE for APTITUDE
        meets_central_threshold: false,  // Force FALSE for APTITUDE
        event_description: null,  // Not applicable
        event_date: null,  // Not applicable
        certificate_url: certificate_url || null,
        remarks: remarks || null
      };
    } else {  // COMMUNICATION
      insertData = {
        studentId,
        evidence_category: 'COMMUNICATION',
        percentile: null,  // Force NULL for COMMUNICATION
        test_completed: false,  // Force FALSE for COMMUNICATION
        test_name: null,  // Not applicable
        test_date: null,  // Not applicable
        has_valid_scorecard: has_valid_scorecard || false,
        meets_central_threshold: meets_central_threshold || false,
        event_description: name || null,
        event_date: event_date || test_date || null,
        certificate_url: certificate_url || null,
        remarks: remarks || null
      };
    }

    const result = await sequelize.query(
      `INSERT INTO aptitude_communication_evidence
       (student_id, evidence_category, percentile, test_completed, test_name, test_date,
        has_valid_scorecard, meets_central_threshold, event_description, event_date,
        certificate_url, remarks, status, submitted_at)
       VALUES (:studentId, :evidence_category, :percentile, :test_completed, :test_name, :test_date,
               :has_valid_scorecard, :meets_central_threshold, :event_description, :event_date,
               :certificate_url, :remarks, 'PENDING', NOW())
       RETURNING *`,
      { replacements: insertData, type: sequelize.QueryTypes.INSERT }
    );
    res.status(201).json({ success: true, evidence: result[0][0] });
  } catch (err) { next(err); }
});

router.get('/student/:studentId', authenticate, [param('studentId').notEmpty()], validate, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (req.user.roll_number !== studentId && req.user.role !== 'mentor') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const evidence = await sequelize.query(
      `SELECT * FROM aptitude_communication_evidence WHERE student_id = :studentId ORDER BY submitted_at DESC`,
      { replacements: { studentId }, type: sequelize.QueryTypes.SELECT }
    );
    res.json({ success: true, evidence: evidence || [] });
  } catch (err) { next(err); }
});

router.get('/pending', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden', message: 'Only mentors can access this endpoint' });
    }

    const evidence = await sequelize.query(
      `SELECT
        e.id,
        e.student_id,
        e.evidence_category,
        e.percentile,
        e.test_completed,
        e.test_name,
        e.test_date,
        e.has_valid_scorecard,
        e.meets_central_threshold,
        e.event_description,
        e.event_date,
        e.certificate_url,
        e.remarks,
        e.status,
        e.submitted_at,
        p.name as student_name,
        p.department
       FROM aptitude_communication_evidence e
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
    console.error('[APTITUDE] Get pending error:', err.message);
    next(err);
  }
});

router.post('/:id/verify', authenticate, [
  param('id').isInt(),
  body('action').isIn(['VERIFIED', 'REJECTED']),
], validate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, rejection_reason } = req.body;
    const evidence = await sequelize.query(
      `SELECT * FROM aptitude_communication_evidence WHERE id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (evidence.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    if (evidence[0].status !== 'PENDING') return res.status(400).json({ success: false, error: 'Already processed' });

    await sequelize.query(
      `UPDATE aptitude_communication_evidence SET status = :status, verified_at = NOW(), rejection_reason = :reason WHERE id = :id`,
      { replacements: { id, status: action, reason: rejection_reason || null }, type: sequelize.QueryTypes.UPDATE }
    );

    if (action === 'VERIFIED') {
      const allEvidence = await sequelize.query(
        `SELECT * FROM aptitude_communication_evidence WHERE student_id = :studentId AND status = 'VERIFIED'`,
        { replacements: { studentId: evidence[0].student_id }, type: sequelize.QueryTypes.SELECT }
      );
      const aptEvidence = allEvidence.filter(e => e.evidence_category === 'APTITUDE');
      let bestApt = 0;
      aptEvidence.forEach(e => { const m = calculateAptitudeMarks(e.test_completed, e.percentile); if (m > bestApt) bestApt = m; });
      const commEvidence = allEvidence.filter(e => e.evidence_category === 'COMMUNICATION');
      let bestComm = 0;
      commEvidence.forEach(e => { const m = calculateCommunicationMarks(e.has_valid_scorecard, e.meets_central_threshold); if (m > bestComm) bestComm = m; });
      const totalMarks = Math.min(20, bestApt + bestComm);
      await sequelize.query(`DELETE FROM scores WHERE register_number = :studentId AND parameter = 'aptitude'`, { replacements: { studentId: evidence[0].student_id }, type: sequelize.QueryTypes.DELETE });
      await sequelize.query(`INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at) VALUES (:studentId, 'aptitude', :marks, 1, false, NOW())`, { replacements: { studentId: evidence[0].student_id, marks: totalMarks }, type: sequelize.QueryTypes.INSERT });
    }
    res.json({ success: true, action });
  } catch (err) { next(err); }
});

router.get('/marks/:studentId', authenticate, [param('studentId').notEmpty()], validate, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const allEvidence = await sequelize.query(
      `SELECT * FROM aptitude_communication_evidence WHERE student_id = :studentId AND status = 'VERIFIED'`,
      { replacements: { studentId }, type: sequelize.QueryTypes.SELECT }
    );
    const aptEvidence = allEvidence.filter(e => e.evidence_category === 'APTITUDE');
    let bestApt = 0, bestPercentile = null;
    aptEvidence.forEach(e => { const m = calculateAptitudeMarks(e.test_completed, e.percentile); if (m > bestApt) { bestApt = m; bestPercentile = e.percentile; } });
    const commEvidence = allEvidence.filter(e => e.evidence_category === 'COMMUNICATION');
    let bestComm = 0, hasThreshold = false;
    commEvidence.forEach(e => { const m = calculateCommunicationMarks(e.has_valid_scorecard, e.meets_central_threshold); if (m > bestComm) { bestComm = m; hasThreshold = e.meets_central_threshold; } });
    const uncapped = bestApt + bestComm;
    const final = Math.min(20, uncapped);
    res.json({ success: true, student_id: studentId, marks: final, max_marks: 20, aptitude_marks: bestApt, aptitude_max: 15, aptitude_submissions: aptEvidence.length, aptitude_best_percentile: bestPercentile, communication_marks: bestComm, communication_max: 5, communication_submissions: commEvidence.length, communication_threshold_met: hasThreshold, uncapped_total: uncapped });
  } catch (err) { next(err); }
});

module.exports = router;