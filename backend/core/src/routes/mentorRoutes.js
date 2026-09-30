/**
 * Mentor Routes
 *
 * Dedicated APIs for Mentor Portal:
 * - View assigned mentees & their readiness scores across 12 parameters
 * - View mentee submissions and pending verification status
 */

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

// All mentor routes require authentication and mentor/admin role
router.use(authenticate);
router.use(requireRole('mentor', 'admin'));

// Helper function to calculate readiness tier
function getReadinessTier(totalScore) {
  const score = parseFloat(totalScore) || 0;
  if (score >= 200) {
    return {
      tier: 'Elite Tier',
      level: 'Elite',
      badgeClass: 'tier-elite',
      color: '#10b981',
      description: 'Top product firms & leadership roles (> 200 marks)'
    };
  } else if (score >= 160) {
    return {
      tier: 'Level 3 - High Tier Product Ready',
      level: 'Level 3',
      badgeClass: 'tier-l3',
      color: '#8b5cf6',
      description: 'High-tier product & R&D readiness (160 - 199 marks)'
    };
  } else if (score >= 120) {
    return {
      tier: 'Level 2 - Placement Ready',
      level: 'Level 2',
      badgeClass: 'tier-l2',
      color: '#3b82f6',
      description: 'Standard campus placement ready (120 - 159 marks)'
    };
  } else if (score >= 80) {
    return {
      tier: 'Level 1 - Foundation Ready',
      level: 'Level 1',
      badgeClass: 'tier-l1',
      color: '#f59e0b',
      description: 'Foundation skills established (80 - 119 marks)'
    };
  } else {
    return {
      tier: 'Not Eligible',
      level: 'Not Eligible',
      badgeClass: 'tier-none',
      color: '#ef4444',
      description: 'Does not meet minimum criteria (< 80 marks)'
    };
  }
}

/**
 * GET /api/mentor/overview
 * Get summary stats for the logged-in mentor
 */
router.get('/overview', async (req, res) => {
  try {
    const mentorId = req.user.id_number;
    const mentorDept = req.user.department;

    // Get assigned students
    const students = await sequelize.query(`
      SELECT 
        p.id_number,
        p.register_number,
        p.name,
        p.department,
        p.email,
        COALESCE(SUM(s.marks), 0) as total_score
      FROM profiles p
      LEFT JOIN scores s ON p.id_number = s.register_number
      WHERE p.role = 'student' 
        AND (p.assigned_mentor_id = :mentorId OR (p.assigned_mentor_id IS NULL AND p.department = :mentorDept))
      GROUP BY p.id_number, p.register_number, p.name, p.department, p.email
      ORDER BY total_score DESC
    `, {
      replacements: { mentorId, mentorDept },
      type: sequelize.QueryTypes.SELECT
    });

    const totalStudents = students.length;
    let totalScoreSum = 0;
    const tierCounts = { elite: 0, l3: 0, l2: 0, l1: 0, not_eligible: 0 };

    students.forEach(st => {
      const score = parseFloat(st.total_score) || 0;
      totalScoreSum += score;
      if (score >= 200) tierCounts.elite++;
      else if (score >= 160) tierCounts.l3++;
      else if (score >= 120) tierCounts.l2++;
      else if (score >= 80) tierCounts.l1++;
      else tierCounts.not_eligible++;
    });

    const avgScore = totalStudents > 0 ? (totalScoreSum / totalStudents).toFixed(1) : 0;

    res.json({
      success: true,
      mentor: {
        id_number: req.user.id_number,
        name: req.user.name,
        department: req.user.department
      },
      stats: {
        totalStudents,
        avgScore: parseFloat(avgScore),
        tierCounts
      }
    });
  } catch (error) {
    console.error('[MENTOR OVERVIEW] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/mentor/my-students
 * Get all students assigned to this mentor with their 12 parameter scores & readiness tier
 */
router.get('/my-students', async (req, res) => {
  try {
    const mentorId = req.user.id_number;
    const mentorDept = req.user.department;
    const { search, tier } = req.query;

    // 1. Fetch assigned students
    const students = await sequelize.query(`
      SELECT 
        p.id_number,
        p.register_number,
        p.name,
        p.email,
        p.department,
        p.college,
        p.assigned_mentor_id
      FROM profiles p
      WHERE p.role = 'student'
        AND (p.assigned_mentor_id = :mentorId OR (p.assigned_mentor_id IS NULL AND p.department = :mentorDept))
      ORDER BY p.id_number ASC
    `, {
      replacements: { mentorId, mentorDept },
      type: sequelize.QueryTypes.SELECT
    });

    if (students.length === 0) {
      return res.json({
        success: true,
        count: 0,
        students: []
      });
    }

    const studentIds = students.map(s => s.id_number);

    // 2. Fetch all scores for these students
    const scores = await sequelize.query(`
      SELECT 
        register_number,
        parameter,
        marks
      FROM scores
      WHERE register_number IN (:studentIds)
    `, {
      replacements: { studentIds },
      type: sequelize.QueryTypes.SELECT
    });

    // 3. Map scores to students
    const scoresMap = {};
    scores.forEach(row => {
      if (!scoresMap[row.register_number]) {
        scoresMap[row.register_number] = {};
      }
      scoresMap[row.register_number][row.parameter] = parseFloat(row.marks) || 0;
    });

    // 4. Assemble student cards
    let formattedStudents = students.map(st => {
      const sMap = scoresMap[st.id_number] || {};
      const totalScore = Object.values(sMap).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
      const roundedTotal = Math.round(totalScore * 10) / 10;
      const readiness = getReadinessTier(roundedTotal);

      return {
        id_number: st.id_number,
        roll_number: st.id_number,
        register_number: st.register_number,
        name: st.name,
        email: st.email,
        department: st.department,
        college: st.college,
        scores: {
          hundred_days: sMap.hundred_days || 0,
          language: sMap.language || 0,
          gate: sMap.gate || 0,
          competition: sMap.competition || 0,
          internship: sMap.internship || 0,
          certificate: sMap.certificate || 0,
          aptitude: sMap.aptitude || 0,
          coding_problems: sMap.coding_problems || 0,
          cp_rating: sMap.cp_rating || 0,
          opensource: sMap.opensource || 0,
          monthly_coding: sMap.monthly_coding || 0,
          project: sMap.project || 0
        },
        total_score: roundedTotal,
        max_possible: 250,
        completed_parameters: Object.keys(sMap).length,
        readiness_tier: readiness
      };
    });

    // Filters
    if (search) {
      const q = search.toLowerCase();
      formattedStudents = formattedStudents.filter(
        s => s.name.toLowerCase().includes(q) || s.id_number.toLowerCase().includes(q) || s.register_number.toLowerCase().includes(q)
      );
    }

    if (tier && tier !== 'ALL') {
      formattedStudents = formattedStudents.filter(s => s.readiness_tier.level === tier);
    }

    res.json({
      success: true,
      count: formattedStudents.length,
      students: formattedStudents
    });
  } catch (error) {
    console.error('[MENTOR MY STUDENTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/mentor/student-detail/:studentId
 * Get detailed profile & all evidence for a specific mentee
 */
router.get('/student-detail/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const [profile] = await sequelize.query(`
      SELECT id_number, register_number, name, email, department, college, assigned_mentor_id
      FROM profiles
      WHERE id_number = :studentId AND role = 'student'
    `, {
      replacements: { studentId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Get scores
    const scores = await sequelize.query(`
      SELECT s.parameter, p.name as parameter_name, s.marks, p.max_marks, s.semester, s.rule_version, s.calculated_at
      FROM scores s
      LEFT JOIN parameters p ON s.parameter = p.id
      WHERE s.register_number = :studentId
    `, {
      replacements: { studentId },
      type: sequelize.QueryTypes.SELECT
    });

    const totalScore = scores.reduce((sum, item) => sum + (parseFloat(item.marks) || 0), 0);
    const readiness = getReadinessTier(totalScore);

    res.json({
      success: true,
      student: profile,
      scores,
      total_score: Math.round(totalScore * 10) / 10,
      readiness_tier: readiness
    });
  } catch (error) {
    console.error('[MENTOR STUDENT DETAIL] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
