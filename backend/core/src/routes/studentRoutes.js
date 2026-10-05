/**
 * Student Dashboard Routes
 *
 * Protected routes for student portal
 * All routes require authentication (JWT token)
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

// Apply authentication to ALL student routes
router.use(authenticate);

/**
 * GET /api/student/dashboard
 *
 * Get student dashboard data (profile + marks summary)
 *
 * Headers:
 *   Authorization: Bearer <JWT_TOKEN>
 *
 * Response:
 * {
 *   "success": true,
 *   "student": {
 *     "roll_number": "24CS360",
 *     "name": "AADHIRAMAN R",
 *     "register_number": "312324104001",
 *     "email": "aadhi012007@gmail.com",
 *     "department": "CSE",
 *     "college": "St. JOSEPH'S ENGINEERING"
 *   },
 *   "marks_summary": {
 *     "total_parameters": 12,
 *     "completed_parameters": 3,
 *     "total_marks": 75.5,
 *     "max_possible": 250
 *   }
 * }
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Student data is already in req.user (from auth middleware)
    const student = req.user;

    // Get marks summary
    const marksSummary = await sequelize.query(
      `SELECT
        COUNT(*) as completed_parameters,
        COALESCE(SUM(marks), 0) as total_marks
      FROM scores
      WHERE roll_number = :rollNumber`,
      {
        replacements: { rollNumber: student.roll_number },
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Get total possible marks from parameters table
    const maxMarks = await sequelize.query(
      `SELECT COALESCE(SUM(max_marks), 250) as max_possible FROM parameters`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      success: true,
      student: {
        roll_number: student.roll_number,
        name: student.name,
        register_number: student.register_number,
        email: student.email,
        department: student.department,
        college: student.college
      },
      marks_summary: {
        total_parameters: 12,
        completed_parameters: parseInt(marksSummary[0]?.completed_parameters || 0),
        total_marks: parseFloat(marksSummary[0]?.total_marks || 0),
        max_possible: parseInt(maxMarks[0]?.max_possible || 250)
      }
    });

  } catch (error) {
    console.error('[DASHBOARD] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard'
    });
  }
});

/**
 * GET /api/student/profile
 *
 * Get student profile details
 */
router.get('/profile', async (req, res) => {
  try {
    res.json({
      success: true,
      student: {
        roll_number: req.user.roll_number,
        name: req.user.name,
        register_number: req.user.register_number,
        email: req.user.email,
        department: req.user.department,
        college: req.user.college
      }
    });
  } catch (error) {
    console.error('[PROFILE] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load profile'
    });
  }
});

/**
 * GET /api/student/scores
 *
 * Get full 12-parameter score breakdown for student
 */
router.get('/scores', async (req, res) => {
  try {
    const rollNumber = req.user.roll_number;

    const scores = await sequelize.query(
      `SELECT
        s.parameter_id as parameter,
        p.name as parameter_name,
        s.marks,
        p.max_marks,
        s.semester,
        s.provisional,
        s.calculated_at
      FROM scores s
      LEFT JOIN parameters p ON s.parameter_id = p.id
      WHERE s.roll_number = :rollNumber
      ORDER BY s.calculated_at DESC`,
      {
        replacements: { rollNumber },
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      student: {
        roll_number: req.user.roll_number,
        name: req.user.name
      },
      scores: scores || []
    });
  } catch (error) {
    console.error('[SCORES] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load scores'
    });
  }
});

/**
 * GET /api/student/marks
 *
 * Get all marks for the logged-in student
 */
router.get('/marks', async (req, res) => {
  try {
    const rollNumber = req.user.roll_number;

    // Get all marks with parameter details
    const marks = await sequelize.query(
      `SELECT
        s.parameter_id as parameter,
        p.name as parameter_name,
        s.marks,
        p.max_marks,
        s.semester,
        s.provisional,
        s.calculated_at
      FROM scores s
      LEFT JOIN parameters p ON s.parameter_id = p.id
      WHERE s.roll_number = :rollNumber
      ORDER BY s.calculated_at DESC`,
      {
        replacements: { rollNumber },
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      student: {
        roll_number: req.user.roll_number,
        name: req.user.name
      },
      marks: marks || []
    });

  } catch (error) {
    console.error('[MARKS] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load marks'
    });
  }
});

/**
 * GET /api/student/marks/:parameter
 *
 * Get marks for a specific parameter
 */
router.get('/marks/:parameter', async (req, res) => {
  try {
    const { parameter } = req.params;
    const rollNumber = req.user.roll_number;

    const result = await sequelize.query(
      `SELECT
        s.parameter_id as parameter,
        p.name as parameter_name,
        s.marks,
        p.max_marks,
        s.semester,
        s.provisional,
        s.calculated_at
      FROM scores s
      LEFT JOIN parameters p ON s.parameter_id = p.id
      WHERE s.roll_number = :rollNumber
      AND s.parameter_id = :parameter`,
      {
        replacements: { rollNumber, parameter },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Marks not found',
        message: `No marks found for parameter: ${parameter}`
      });
    }

    res.json({
      success: true,
      student: {
        roll_number: req.user.roll_number,
        name: req.user.name
      },
      parameter: {
        id: result[0].parameter,
        name: result[0].parameter_name,
        max_marks: result[0].max_marks,
        marks: result[0].marks,
        semester: result[0].semester,
        provisional: result[0].provisional,
        calculated_at: result[0].calculated_at
      }
    });

  } catch (error) {
    console.error('[MARKS] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load marks'
    });
  }
});

/**
 * GET /api/student/evidence
 *
 * Get all evidence submitted by the student
 *
 * Response:
 * {
 *   "success": true,
 *   "student": {
 *     "roll_number": "24CS360",
 *     "name": "AADHIRAMAN R"
 *   },
 *   "evidence": [
 *     {
 *       "id": 1,
 *       "type": "project",
 *       "status": "approved",
 *       "semester": 5,
 *       "submitted_at": "2026-09-28T..."
 *     }
 *   ]
 * }
 */
router.get('/evidence', async (req, res) => {
  try {
    const rollNumber = req.user.roll_number;

    // Get all evidence from project_evidence
    const evidence = await sequelize.query(
      `SELECT 
        id,
        'project' as type,
        status,
        semester,
        output_name as title,
        achievement_type as description,
        COALESCE(submitted_at, created_at) as submitted_at,
        verified_at as reviewed_at
      FROM project_evidence
      WHERE student_id = :rollNumber
      ORDER BY COALESCE(submitted_at, created_at) DESC`,
      {
        replacements: { rollNumber },
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      student: {
        roll_number: req.user.roll_number,
        name: req.user.name
      },
      evidence: evidence || []
    });

  } catch (error) {
    console.error('[EVIDENCE] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load evidence'
    });
  }
});

module.exports = router;
