/**
 * Anomaly & Duplicate Detection Routes
 *
 * Provides endpoints for:
 * 1. Pre-submission integrity & duplicate check
 * 2. Mentor / Admin anomaly flags review queue
 * 3. Database-wide integrity scan
 * 4. Anomaly resolution workflow
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const AnomalyDetectionService = require('../services/anomalyDetectionService');

const router = express.Router();

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

/**
 * POST /api/anomaly/check
 * Pre-submission duplicate & reuse check
 */
router.post(
  '/check',
  authenticate,
  [
    body('module').notEmpty().withMessage('module is required'),
    body('payload').isObject().withMessage('payload must be an object'),
    body('semester').optional().isInt({ min: 1, max: 8 })
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number || req.body.student_id;
      const { module, payload, semester } = req.body;

      const result = await AnomalyDetectionService.validateSubmission({
        module,
        studentId,
        semester,
        payload
      });

      res.json({
        success: true,
        allowed: result.allowed,
        has_anomaly: result.has_anomaly,
        anomalies: result.anomalies
      });
    } catch (err) {
      console.error('[ANOMALY] Check error:', err);
      next(err);
    }
  }
);

/**
 * GET /api/anomaly/flags
 * Get flagged anomalies for mentor / admin queue
 */
router.get(
  '/flags',
  authenticate,
  async (req, res, next) => {
    try {
      const mentorRole = req.user.role;
      const mentorDepartment = req.user.department;
      const status = req.query.status || 'FLAGGED';
      const severity = req.query.severity || null;
      const studentId = req.query.student_id || null;

      const flags = await AnomalyDetectionService.getFlaggedAnomalies({
        department: mentorDepartment,
        mentorRole,
        status,
        severity,
        studentId
      });

      res.json({
        success: true,
        count: flags.length,
        anomalies: flags
      });
    } catch (err) {
      console.error('[ANOMALY] Get flags error:', err);
      next(err);
    }
  }
);

/**
 * POST /api/anomaly/scan-all
 * Run project-wide integrity scan across all modules
 */
router.post(
  '/scan-all',
  authenticate,
  async (req, res, next) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'mentor') {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      const report = await AnomalyDetectionService.scanAllIntegrity();

      res.json({
        success: true,
        message: 'Project-wide integrity scan completed',
        ...report
      });
    } catch (err) {
      console.error('[ANOMALY] Scan all error:', err);
      next(err);
    }
  }
);

/**
 * POST /api/anomaly/resolve/:id
 * Resolve an anomaly flag (DISMISSED, CONFIRMED_FRAUD, APPROVED_COLLABORATION)
 */
router.post(
  '/resolve/:id',
  authenticate,
  [
    param('id').isInt().withMessage('id must be an integer'),
    body('status').isIn(['DISMISSED', 'CONFIRMED_FRAUD', 'APPROVED_COLLABORATION']).withMessage('Invalid status'),
    body('notes').optional().isString()
  ],
  validate,
  async (req, res, next) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'mentor') {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      const id = parseInt(req.params.id, 10);
      const { status, notes } = req.body;
      const mentorId = req.user.roll_number || req.user.id || req.user.email;

      const resolved = await AnomalyDetectionService.resolveAnomaly({
        id,
        resolutionStatus: status,
        mentorId,
        notes
      });

      res.json({
        success: true,
        message: `Anomaly ${status.toLowerCase()}`,
        anomaly: resolved
      });
    } catch (err) {
      console.error('[ANOMALY] Resolve error:', err);
      next(err);
    }
  }
);

/**
 * GET /api/anomaly/student/:studentId
 * Get integrity history and anomaly report for a specific student
 */
router.get(
  '/student/:studentId',
  authenticate,
  [
    param('studentId').notEmpty().withMessage('studentId is required')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const mentorRole = req.user.role;
      const mentorDepartment = req.user.department;

      const flags = await AnomalyDetectionService.getFlaggedAnomalies({
        department: mentorDepartment,
        mentorRole,
        status: null, // all statuses
        studentId
      });

      const isClean = flags.filter(f => f.status === 'FLAGGED' || f.status === 'CONFIRMED_FRAUD').length === 0;

      res.json({
        success: true,
        student_id: studentId,
        is_clean: isClean,
        total_flags: flags.length,
        anomalies: flags
      });
    } catch (err) {
      console.error('[ANOMALY] Student history error:', err);
      next(err);
    }
  }
);

module.exports = router;
