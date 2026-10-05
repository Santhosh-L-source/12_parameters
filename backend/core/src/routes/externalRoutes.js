const express = require('express');
const { param, query, body, validationResult } = require('express-validator');
const { authenticateExternalApiKey } = require('../middleware/externalAuth');
const externalExportService = require('../services/externalExportService');

const router = express.Router();

// Apply API Key Authentication to all external integration routes
router.use(authenticateExternalApiKey);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

/**
 * GET /api/v1/external/students/results
 * Bulk Student Results Export with pagination, year (2nd/3rd year), semester, and department/batch filters
 */
router.get(
  '/students/results',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
    query('department').optional().isString().trim(),
    query('batch').optional().isString().trim(),
    query('year').optional().isString().trim(),
    query('semester').optional().isString().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { department, batch, year, semester, page = 1, limit = 50 } = req.query;
      const result = await externalExportService.getBulkResults({
        department,
        batch,
        year,
        semester,
        page,
        limit,
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        client: req.externalClient?.client_name || 'PARTNER',
        data: result,
      });
    } catch (err) {
      console.error('[EXTERNAL_API] Bulk export error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to export student results' });
    }
  }
);

/**
 * GET /api/v1/external/students/:rollNumber/results
 * Single Student Result Lookup
 */
router.get(
  '/students/:rollNumber/results',
  [param('rollNumber').notEmpty().withMessage('rollNumber is required').trim()],
  validate,
  async (req, res) => {
    try {
      const { rollNumber } = req.params;
      const studentResult = await externalExportService.getStudentResult(rollNumber);

      if (!studentResult) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Student with Roll Number "${rollNumber}" was not found.`,
        });
      }

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        client: req.externalClient?.client_name || 'PARTNER',
        data: studentResult,
      });
    } catch (err) {
      console.error('[EXTERNAL_API] Single lookup error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to fetch student results' });
    }
  }
);

/**
 * POST /api/v1/external/students/batch-lookup
 * Batch Lookup for explicit list of Roll Numbers
 */
router.post(
  '/students/batch-lookup',
  [
    body('roll_numbers')
      .isArray({ min: 1, max: 100 })
      .withMessage('roll_numbers must be an array between 1 and 100 items'),
  ],
  validate,
  async (req, res) => {
    try {
      const { roll_numbers } = req.body;
      const results = await externalExportService.getBatchLookupResults(roll_numbers);

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        client: req.externalClient?.client_name || 'PARTNER',
        total_requested: roll_numbers.length,
        total_found: results.length,
        data: results,
      });
    } catch (err) {
      console.error('[EXTERNAL_API] Batch lookup error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to perform batch lookup' });
    }
  }
);

module.exports = router;
