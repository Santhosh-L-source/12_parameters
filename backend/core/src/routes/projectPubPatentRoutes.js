/**
 * Project / Publication / Patent Routes
 *
 * Module: Project / Publication / Patent (20 marks)
 * Verification: Mentor verification & review queue
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

const ACHIEVEMENT_TYPES = ['PROJECT', 'PUBLICATION', 'PATENT'];
const MAX_MARKS = 20;

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
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
    console.warn('[PROJECT] Failed to update profile total_score:', err.message);
  }
}

/**
 * POST /api/project-pub-patent/submit or /
 */
const handleSubmit = async (req, res, next) => {
  try {
    const studentRoll = req.user.roll_number || req.user.id_number;
    const title = (req.body.title || req.body.output_name || req.body.outputName || '').trim();
    const type = (req.body.type || req.body.achievement_type || req.body.achievementType || 'PROJECT').toUpperCase();
    const description = req.body.description || req.body.achievement_stage || null;
    const githubRepoUrl = req.body.github_repo_url || req.body.proof_url || req.body.proofUrl || null;
    const liveDemoUrl = req.body.live_demo_url || null;
    const paperDoi = req.body.paper_doi_or_patent_no || null;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const canonicalRoll = await resolveStudentRoll(studentRoll);
    const distinctKey = title;
    const distinctKeyNorm = distinctKey.toLowerCase().trim();

    const existing = await sequelize.query(
      `SELECT id FROM project_evidence
       WHERE LOWER(roll_number) = LOWER(:canonicalRoll) 
         AND (distinct_key_normalized = :distinctKeyNorm OR distinct_key = :distinctKey)`,
      {
        replacements: { canonicalRoll, distinctKey, distinctKeyNorm },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate submission',
        message: `You have already submitted evidence for "${title}". To update, contact your mentor.`
      });
    }

    const insertResult = await sequelize.query(
      `INSERT INTO project_evidence
       (roll_number, distinct_key, title, type, description,
        github_repo_url, live_demo_url, paper_doi_or_patent_no, status, submitted_at)
       VALUES (:canonicalRoll, :distinctKey, :title, :type, :description,
               :githubRepoUrl, :liveDemoUrl, :paperDoi, 'PENDING', NOW())
       RETURNING id, roll_number, title, type, status, submitted_at`,
      {
        replacements: {
          canonicalRoll,
          distinctKey,
          title,
          type,
          description,
          githubRepoUrl,
          liveDemoUrl,
          paperDoi
        },
        type: sequelize.QueryTypes.INSERT
      }
    );

    const evidence = insertResult && Array.isArray(insertResult) && insertResult[0] && Array.isArray(insertResult[0]) 
      ? insertResult[0][0] 
      : (insertResult && insertResult[0] ? insertResult[0] : {});

    res.status(201).json({
      success: true,
      message: 'Evidence submitted successfully',
      evidence
    });
  } catch (err) {
    console.error('[PROJECT] Submit error:', err.message);
    next(err);
  }
};

router.post('/', authenticate, handleSubmit);
router.post('/submit', authenticate, handleSubmit);

/**
 * GET /api/project-pub-patent/student/:studentId
 */
router.get(
  '/student/:studentId',
  authenticate,
  [param('studentId').notEmpty()],
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
          title,
          type,
          description,
          github_repo_url,
          live_demo_url,
          paper_doi_or_patent_no,
          status,
          verified_by_mentor_roll as mentor_id,
          verified_at,
          submitted_at
         FROM project_evidence
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
      console.error('[PROJECT] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/project-pub-patent/pending
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

      const mentorDept = req.user.department;
      const mentorRole = req.user.role;
      const mentorRoll = req.user.roll_number || req.user.id_number;

      const evidence = await sequelize.query(
        `SELECT
          e.id,
          e.roll_number as student_id,
          e.title,
          e.type,
          e.description,
          e.github_repo_url,
          e.live_demo_url,
          e.paper_doi_or_patent_no,
          e.status,
          e.submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM project_evidence e
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
      console.error('[PROJECT] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/project-pub-patent/:id/verify & PUT /:id/verify
 */
const handleVerify = async (req, res, next) => {
  try {
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only mentors and administrators can verify evidence'
      });
    }

    const { id } = req.params;
    const action = req.body.action || (req.body.status === 'VERIFIED' ? 'VERIFIED' : 'REJECTED');
    const mentorRoll = req.user.roll_number || req.user.id_number || 'MENTOR';

    const evidence = await sequelize.query(
      `SELECT * FROM project_evidence WHERE id = :id`,
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
      `UPDATE project_evidence
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
      const verifiedRows = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized, type
         FROM project_evidence
         WHERE LOWER(roll_number) = LOWER(:studentRoll) AND status = 'VERIFIED'`,
        {
          replacements: { studentRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let totalMarks = 0;
      for (const ev of (verifiedRows || [])) {
        const t = (ev.type || '').toUpperCase();
        const m = t === 'PATENT' ? 20 : (t === 'PUBLICATION' ? 15 : 10);
        totalMarks += m;
      }
      const finalMarks = Math.min(MAX_MARKS, totalMarks);

      await sequelize.query(
        `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
         VALUES (:studentRoll, 'project', :finalMarks, 1, false, NOW())
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
    console.error('[PROJECT] Verify error:', err.message);
    next(err);
  }
};

router.put('/:id/verify', authenticate, [param('id').isUUID()], validate, handleVerify);
router.post('/:id/verify', authenticate, [param('id').isUUID()], validate, handleVerify);

/**
 * GET /api/project-pub-patent/marks/:studentId
 */
router.get(
  '/marks/:studentId',
  authenticate,
  [param('studentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const canonicalRoll = await resolveStudentRoll(studentId);

      // 1. Check scores table first
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll)
           AND parameter_id IN ('project', 'project_pub_patent', 'proj_score', 'proj')
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
          max_marks: MAX_MARKS
        });
      }

      // 2. Check project_evidence table
      const evidence = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized, type
         FROM project_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        {
          replacements: { canonicalRoll },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let totalMarks = 0;
      if (evidence && evidence.length > 0) {
        for (const ev of evidence) {
          const t = (ev.type || '').toUpperCase();
          totalMarks += (t === 'PATENT' ? 20 : (t === 'PUBLICATION' ? 15 : 10));
        }
        totalMarks = Math.min(MAX_MARKS, totalMarks);
      }

      res.json({
        success: true,
        student_id: canonicalRoll,
        marks: totalMarks,
        max_marks: MAX_MARKS,
        evidenceCount: evidence ? evidence.length : 0
      });
    } catch (err) {
      console.error('[PROJECT] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
