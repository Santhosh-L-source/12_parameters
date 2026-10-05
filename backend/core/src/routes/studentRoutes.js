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
 */
router.get('/dashboard', async (req, res) => {
  try {
    const student = req.user;
    const rollNumber = student.roll_number || student.id_number;

    // Get marks summary
    const marksSummary = await sequelize.query(
      `SELECT
        COUNT(*) as completed_parameters,
        COALESCE(SUM(marks), 0) as total_marks
      FROM scores
      WHERE LOWER(roll_number) = LOWER(:rollNumber)`,
      {
        replacements: { rollNumber },
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
        college: student.college || (((student.register_number && student.register_number.startsWith('3124')) || (student.roll_number && student.roll_number.startsWith('3124'))) 
          ? "St. Joseph's Institute of Technology" 
          : "St. Joseph's College of Engineering")
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
 * Get student profile details
 */
router.get('/profile', async (req, res) => {
  try {
    const reg = req.user.register_number || '';
    const roll = req.user.roll_number || '';
    const inferredCollege = (reg.startsWith('3124') || roll.startsWith('3124'))
      ? "St. Joseph's Institute of Technology"
      : "St. Joseph's College of Engineering";

    res.json({
      success: true,
      student: {
        roll_number: req.user.roll_number,
        name: req.user.name,
        register_number: req.user.register_number,
        email: req.user.email,
        department: req.user.department,
        college: req.user.college || inferredCollege
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
 * Get full 12-parameter score breakdown for student
 */
router.get('/scores', async (req, res) => {
  try {
    const rollNumber = req.user.roll_number || req.user.id_number;

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
      WHERE LOWER(s.roll_number) = LOWER(:rollNumber)
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
 * Get all marks for the logged-in student
 */
router.get('/marks', async (req, res) => {
  try {
    const rollNumber = req.user.roll_number || req.user.id_number;

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
      WHERE LOWER(s.roll_number) = LOWER(:rollNumber)
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
 * Get marks for a specific parameter
 */
router.get('/marks/:parameter', async (req, res) => {
  try {
    const { parameter } = req.params;
    const rollNumber = req.user.roll_number || req.user.id_number;

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
      WHERE LOWER(s.roll_number) = LOWER(:rollNumber)
      AND LOWER(s.parameter_id) = LOWER(:parameter)`,
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
 * Get all evidence submitted by the student across all parameters
 */
router.get('/evidence', async (req, res) => {
  try {
    const rollNumber = req.user.roll_number || req.user.id_number;

    const evidence = await sequelize.query(
      `SELECT 
        id,
        'project' as type,
        status,
        title,
        description,
        submitted_at,
        verified_at as reviewed_at
      FROM project_evidence
      WHERE LOWER(roll_number) = LOWER(:rollNumber)
      ORDER BY submitted_at DESC`,
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
