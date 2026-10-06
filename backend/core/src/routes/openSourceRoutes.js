/**
 * Open Source Contributions Routes
 *
 * Scoring: MAX stage per repo, SUM across repos, cap at 20
 * Stages (per repo):
 *   3:  1 PR submitted (not merged)
 *   5:  1 PR merged
 *   10: 3 PRs merged
 *   15: 5+ PRs merged
 *   17: Selected in approved programme
 *   20: Maintainer or programme completion
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

let fetchGitHubOpenSourceStats, verifyGitHubOwnership;
try {
  const gh = require('../../../services/coding-platform/src/fetchers/githubOpenSourceFetcher');
  fetchGitHubOpenSourceStats = gh.fetchGitHubOpenSourceStats;
  verifyGitHubOwnership = gh.verifyGitHubOwnership;
} catch (e) {
  console.warn('[OPEN_SOURCE] Initial githubOpenSourceFetcher require:', e.message);
}

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
    console.warn('[OPEN_SOURCE] Failed to update profile total_score:', err.message);
  }
}

function calculateStage(prs_submitted, prs_merged, programme_selected, is_maintainer, programme_completed) {
  if (is_maintainer || programme_completed) return 20;
  if (programme_selected) return 17;
  if (prs_merged >= 5) return 15;
  if (prs_merged >= 3) return 10;
  if (prs_merged >= 1) return 5;
  if (prs_submitted >= 1) return 3;
  return 0;
}

/**
 * POST /api/open-source/verify-ownership
 */
router.post(
  '/verify-ownership',
  authenticate,
  [
    body('github_username').notEmpty().withMessage('github_username is required'),
    body('token').notEmpty().withMessage('token is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const { github_username, github_url, token } = req.body;
      const canonicalRoll = await resolveStudentRoll(studentRoll);
      const username = github_username.replace('@', '').trim();

      if (!verifyGitHubOwnership) {
        const gh = require('../../../services/coding-platform/src/fetchers/githubOpenSourceFetcher');
        verifyGitHubOwnership = gh.verifyGitHubOwnership;
        fetchGitHubOpenSourceStats = gh.fetchGitHubOpenSourceStats;
      }

      const verifyResult = await verifyGitHubOwnership(username, token);
      if (!verifyResult || !verifyResult.verified) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: 'Verification Failed',
          message: verifyResult?.reason || `Verification code "${token}" was not found in @${username}'s GitHub bio or profile.`
        });
      }

      // Fetch live stats from GitHub
      const stats = await fetchGitHubOpenSourceStats(github_url || username, username);
      const repoName = stats.repo_name || `${username}/contributions`;
      const distinct_key = repoName;
      const distinct_key_norm = distinct_key.toLowerCase().trim();

      const existing = await sequelize.query(
        `SELECT id FROM open_source_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) 
           AND (distinct_key_normalized = :distinct_key_norm OR repo_name = :repoName OR LOWER(github_username) = LOWER(:username))`,
        { replacements: { canonicalRoll, distinct_key_norm, repoName, username }, type: sequelize.QueryTypes.SELECT }
      );

      let savedId;
      if (existing.length > 0) {
        savedId = existing[0].id;
        await sequelize.query(
          `UPDATE open_source_evidence
           SET github_username = :username,
               repo_name = :repoName,
               distinct_key = :distinct_key,
               prs_submitted = :prsSubmitted,
               prs_merged = :prsMerged,
               is_maintainer = :isMaintainer,
               repo_url = :repoUrl,
               status = 'VERIFIED',
               verified_at = NOW(),
               last_fetched_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: savedId,
              username,
              repoName,
              distinct_key,
              prsSubmitted: stats.prs_submitted || 0,
              prsMerged: stats.prs_merged || 0,
              isMaintainer: Boolean(stats.is_maintainer),
              repoUrl: stats.repo_url || `https://github.com/${username}`
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        const insertRes = await sequelize.query(
          `INSERT INTO open_source_evidence
           (roll_number, github_username, repo_name, distinct_key,
            prs_submitted, prs_merged, is_maintainer, programme_selected, programme_completed,
            repo_url, fetch_method, status, submitted_at, verified_at, last_fetched_at)
           VALUES (:canonicalRoll, :username, :repoName, :distinct_key,
                   :prsSubmitted, :prsMerged, :isMaintainer, false, false,
                   :repoUrl, 'GITHUB_API', 'VERIFIED', NOW(), NOW(), NOW())
           RETURNING id`,
          {
            replacements: {
              canonicalRoll,
              username,
              repoName,
              distinct_key,
              prsSubmitted: stats.prs_submitted || 0,
              prsMerged: stats.prs_merged || 0,
              isMaintainer: Boolean(stats.is_maintainer),
              repoUrl: stats.repo_url || `https://github.com/${username}`
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
        savedId = insertRes && Array.isArray(insertRes) && insertRes[0] ? (insertRes[0][0]?.id || insertRes[0].id) : null;
      }

      // Recalculate marks
      const allVerified = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized,
                MAX(prs_submitted) as prs_submitted,
                MAX(prs_merged) as prs_merged,
                BOOL_OR(programme_selected) as programme_selected,
                BOOL_OR(is_maintainer) as is_maintainer,
                BOOL_OR(programme_completed) as programme_completed
         FROM open_source_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'
         GROUP BY distinct_key_normalized`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      let uncappedTotal = 0;
      allVerified.forEach(e => {
        const stage = calculateStage(
          e.prs_submitted || 0,
          e.prs_merged || 0,
          e.programme_selected || false,
          e.is_maintainer || false,
          e.programme_completed || false
        );
        uncappedTotal += stage;
      });
      const finalMarks = Math.min(20, uncappedTotal);

      await sequelize.query(
        `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
         VALUES (:canonicalRoll, 'open_source', :finalMarks, 1, false, NOW())
         ON CONFLICT (roll_number, parameter_id, semester)
         DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
        { replacements: { canonicalRoll, finalMarks }, type: sequelize.QueryTypes.INSERT }
      );

      await updateStudentProfileScore(canonicalRoll);

      res.json({
        success: true,
        verified: true,
        marks: finalMarks,
        message: `Ownership verified for GitHub @${username}! PRs Merged: ${stats.prs_merged || 0}, Maintainer: ${stats.is_maintainer ? 'Yes' : 'No'}. Marks: ${finalMarks}/20`,
        stats
      });
    } catch (err) {
      console.error('[OPEN_SOURCE] Verify ownership error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/open-source/sync
 */
router.post(
  '/sync',
  authenticate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const canonicalRoll = await resolveStudentRoll(studentRoll);

      const verified = await sequelize.query(
        `SELECT id, github_username, repo_url, repo_name FROM open_source_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      if (!fetchGitHubOpenSourceStats) {
        const gh = require('../../../services/coding-platform/src/fetchers/githubOpenSourceFetcher');
        fetchGitHubOpenSourceStats = gh.fetchGitHubOpenSourceStats;
      }

      for (const item of verified) {
        const username = item.github_username;
        if (username) {
          const stats = await fetchGitHubOpenSourceStats(item.repo_url || username, username);
          await sequelize.query(
            `UPDATE open_source_evidence
             SET prs_submitted = :prsSubmitted,
                 prs_merged = :prsMerged,
                 is_maintainer = :isMaintainer,
                 last_fetched_at = NOW()
             WHERE id = :id`,
            {
              replacements: {
                id: item.id,
                prsSubmitted: stats.prs_submitted || 0,
                prsMerged: stats.prs_merged || 0,
                isMaintainer: Boolean(stats.is_maintainer)
              },
              type: sequelize.QueryTypes.UPDATE
            }
          );
        }
      }

      // Recalculate marks
      const allVerified = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized,
                MAX(prs_submitted) as prs_submitted,
                MAX(prs_merged) as prs_merged,
                BOOL_OR(programme_selected) as programme_selected,
                BOOL_OR(is_maintainer) as is_maintainer,
                BOOL_OR(programme_completed) as programme_completed
         FROM open_source_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'
         GROUP BY distinct_key_normalized`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      let uncappedTotal = 0;
      allVerified.forEach(e => {
        const stage = calculateStage(
          e.prs_submitted || 0,
          e.prs_merged || 0,
          e.programme_selected || false,
          e.is_maintainer || false,
          e.programme_completed || false
        );
        uncappedTotal += stage;
      });
      const finalMarks = Math.min(20, uncappedTotal);

      await sequelize.query(
        `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
         VALUES (:canonicalRoll, 'open_source', :finalMarks, 1, false, NOW())
         ON CONFLICT (roll_number, parameter_id, semester)
         DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
        { replacements: { canonicalRoll, finalMarks }, type: sequelize.QueryTypes.INSERT }
      );

      await updateStudentProfileScore(canonicalRoll);

      res.json({
        success: true,
        marks: finalMarks,
        message: 'Open source contributions re-synced successfully!'
      });
    } catch (err) {
      console.error('[OPEN_SOURCE] Sync error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/open-source/submit
 */
router.post(
  '/submit',
  authenticate,
  [
    body('github_username').optional().isString(),
    body('repo_name').optional().isString(),
    body('repo_url').optional({ checkFalsy: true }).isString(),
    body('prs_submitted').optional(),
    body('prs_merged').optional(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const githubUsername = (req.body.github_username || 'user').trim();
      const repoName = (req.body.repo_name || `${githubUsername}/contributions`).trim();
      const repoUrl = req.body.repo_url || `https://github.com/${githubUsername}`;
      const prsSubmitted = parseInt(req.body.prs_submitted) || 1;
      const prsMerged = parseInt(req.body.prs_merged) || 1;
      const isMaintainer = Boolean(req.body.is_maintainer);
      const programmeSelected = Boolean(req.body.programme_selected);
      const programmeCompleted = Boolean(req.body.programme_completed);

      const canonicalRoll = await resolveStudentRoll(studentRoll);
      const distinct_key = repoName;
      const distinct_key_norm = distinct_key.toLowerCase().trim();

      const existing = await sequelize.query(
        `SELECT id FROM open_source_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) 
           AND (distinct_key_normalized = :distinct_key_norm OR repo_name = :repoName)`,
        {
          replacements: { canonicalRoll, distinct_key_norm, repoName },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let evidence;
      let isUpdate = false;

      if (existing.length > 0) {
        isUpdate = true;
        await sequelize.query(
          `UPDATE open_source_evidence
           SET github_username = :githubUsername,
               repo_name = :repoName,
               distinct_key = :distinct_key,
               prs_submitted = :prsSubmitted,
               prs_merged = :prsMerged,
               is_maintainer = :isMaintainer,
               programme_selected = :programmeSelected,
               programme_completed = :programmeCompleted,
               repo_url = :repoUrl,
               status = 'VERIFIED',
               verified_at = NOW(),
               last_fetched_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              githubUsername,
              repoName,
              distinct_key,
              prsSubmitted,
              prsMerged,
              isMaintainer,
              programmeSelected,
              programmeCompleted,
              repoUrl
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
        evidence = { id: existing[0].id, github_username: githubUsername, repo_name: repoName, prs_submitted: prsSubmitted, prs_merged: prsMerged, status: 'VERIFIED' };
      } else {
        const insertResult = await sequelize.query(
          `INSERT INTO open_source_evidence
           (roll_number, github_username, repo_name, distinct_key,
            prs_submitted, prs_merged, is_maintainer, programme_selected, programme_completed,
            repo_url, fetch_method, status, submitted_at, verified_at, last_fetched_at)
           VALUES (:canonicalRoll, :githubUsername, :repoName, :distinct_key,
                   :prsSubmitted, :prsMerged, :isMaintainer, :programmeSelected, :programmeCompleted,
                   :repoUrl, 'GITHUB_API', 'VERIFIED', NOW(), NOW(), NOW())
           RETURNING id, roll_number, github_username, repo_name, prs_submitted, prs_merged, status, submitted_at`,
          {
            replacements: {
              canonicalRoll,
              githubUsername,
              repoName,
              distinct_key,
              prsSubmitted,
              prsMerged,
              isMaintainer,
              programmeSelected,
              programmeCompleted,
              repoUrl
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
        evidence = insertResult && Array.isArray(insertResult) && insertResult[0] && Array.isArray(insertResult[0]) 
          ? insertResult[0][0] 
          : (insertResult && insertResult[0] ? insertResult[0] : {});
      }

      // Recalculate marks
      const allVerified = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized,
                MAX(prs_submitted) as prs_submitted,
                MAX(prs_merged) as prs_merged,
                BOOL_OR(programme_selected) as programme_selected,
                BOOL_OR(is_maintainer) as is_maintainer,
                BOOL_OR(programme_completed) as programme_completed
         FROM open_source_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'
         GROUP BY distinct_key_normalized`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      let uncappedTotal = 0;
      allVerified.forEach(e => {
        const stage = calculateStage(
          e.prs_submitted || 0,
          e.prs_merged || 0,
          e.programme_selected || false,
          e.is_maintainer || false,
          e.programme_completed || false
        );
        uncappedTotal += stage;
      });
      const finalMarks = Math.min(20, uncappedTotal);

      await sequelize.query(
        `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
         VALUES (:canonicalRoll, 'open_source', :finalMarks, 1, false, NOW())
         ON CONFLICT (roll_number, parameter_id, semester)
         DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
        { replacements: { canonicalRoll, finalMarks }, type: sequelize.QueryTypes.INSERT }
      );

      await updateStudentProfileScore(canonicalRoll);

      res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: `Open source contribution recorded! Marks: ${finalMarks}/20`,
        evidence,
        marks: finalMarks
      });
    } catch (err) {
      console.error('[OPEN_SOURCE] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/open-source/student/:studentId
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
          github_username,
          repo_name,
          prs_submitted,
          prs_merged,
          is_maintainer,
          programme_selected,
          programme_completed,
          repo_url,
          status,
          verified_by_mentor_roll as mentor_id,
          verified_at,
          submitted_at
         FROM open_source_evidence
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
      console.error('[OPEN_SOURCE] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/open-source/pending
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
          e.github_username,
          e.repo_name,
          e.prs_submitted,
          e.prs_merged,
          e.repo_url,
          e.status,
          e.submitted_at,
          s.name as student_name,
          s.department,
          s.register_number
         FROM open_source_evidence e
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
      console.error('[OPEN_SOURCE] Get pending error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/open-source/:id/verify
 */
router.post(
  '/:id/verify',
  authenticate,
  [
    param('id').isUUID().withMessage('id must be a valid UUID'),
    body('action')
      .isIn(['VERIFIED', 'REJECTED'])
      .withMessage('action must be VERIFIED or REJECTED'),
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
        `SELECT * FROM open_source_evidence WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.SELECT }
      );

      if (evidence.length === 0) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      const studentRoll = evidence[0].roll_number;

      await sequelize.query(
        `UPDATE open_source_evidence
         SET status = :status,
             verified_by_mentor_roll = :mentorRoll,
             verified_at = NOW()
         WHERE id = :id`,
        { replacements: { id, status: action, mentorRoll }, type: sequelize.QueryTypes.UPDATE }
      );

      if (action === 'VERIFIED') {
        const allVerified = await sequelize.query(
          `SELECT DISTINCT distinct_key_normalized,
                  MAX(prs_submitted) as prs_submitted,
                  MAX(prs_merged) as prs_merged,
                  BOOL_OR(programme_selected) as programme_selected,
                  BOOL_OR(is_maintainer) as is_maintainer,
                  BOOL_OR(programme_completed) as programme_completed
           FROM open_source_evidence
           WHERE LOWER(roll_number) = LOWER(:studentRoll) AND status = 'VERIFIED'
           GROUP BY distinct_key_normalized`,
          { replacements: { studentRoll }, type: sequelize.QueryTypes.SELECT }
        );

        let uncappedTotal = 0;
        allVerified.forEach(e => {
          const stage = calculateStage(
            e.prs_submitted || 0,
            e.prs_merged || 0,
            e.programme_selected || false,
            e.is_maintainer || false,
            e.programme_completed || false
          );
          uncappedTotal += stage;
        });
        const finalMarks = Math.min(20, uncappedTotal);

        await sequelize.query(
          `INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
           VALUES (:studentRoll, 'open_source', :finalMarks, 1, false, NOW())
           ON CONFLICT (roll_number, parameter_id, semester)
           DO UPDATE SET marks = EXCLUDED.marks, provisional = false, calculated_at = NOW()`,
          { replacements: { studentRoll, finalMarks }, type: sequelize.QueryTypes.INSERT }
        );

        await updateStudentProfileScore(studentRoll);
      }

      res.json({ success: true, message: `Evidence ${action.toLowerCase()} successfully`, action });
    } catch (err) {
      console.error('[OPEN_SOURCE] Verify error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/open-source/marks/:studentId
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
           AND parameter_id IN ('oss', 'open_source', 'opensource', 'oss_score')
         ORDER BY marks DESC LIMIT 1`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      if (scoreRows && scoreRows.length > 0 && parseFloat(scoreRows[0].marks) > 0) {
        return res.json({
          success: true,
          student_id: canonicalRoll,
          marks: parseFloat(scoreRows[0].marks),
          max_marks: 20
        });
      }

      // 2. Check evidence table
      const allEvidence = await sequelize.query(
        `SELECT DISTINCT distinct_key_normalized,
                MAX(prs_submitted) as prs_submitted,
                MAX(prs_merged) as prs_merged,
                BOOL_OR(programme_selected) as programme_selected,
                BOOL_OR(is_maintainer) as is_maintainer,
                BOOL_OR(programme_completed) as programme_completed
         FROM open_source_evidence
         WHERE LOWER(roll_number) = LOWER(:canonicalRoll) AND status = 'VERIFIED'
         GROUP BY distinct_key_normalized`,
        { replacements: { canonicalRoll }, type: sequelize.QueryTypes.SELECT }
      );

      let uncappedTotal = 0;
      allEvidence.forEach(e => {
        const stage = calculateStage(
          e.prs_submitted || 0,
          e.prs_merged || 0,
          e.programme_selected || false,
          e.is_maintainer || false,
          e.programme_completed || false
        );
        uncappedTotal += stage;
      });
      const finalMarks = Math.min(20, uncappedTotal);

      res.json({
        success: true,
        student_id: canonicalRoll,
        marks: finalMarks,
        max_marks: 20,
        contributions_count: allEvidence ? allEvidence.length : 0
      });
    } catch (err) {
      console.error('[OPEN_SOURCE] Calculate marks error:', err.message);
      next(err);
    }
  }
);

/**
 * DELETE /api/open-source/:id
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  validate,
  async (req, res, next) => {
    try {
      const studentRoll = req.user.roll_number || req.user.id_number;
      const { id } = req.params;
      const canonicalRoll = await resolveStudentRoll(studentRoll);

      const existing = await sequelize.query(
        `SELECT * FROM open_source_evidence WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.SELECT }
      );

      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Contribution not found' });
      }

      if (req.user.role !== 'admin' && req.user.role !== 'mentor' && existing[0].roll_number.toLowerCase() !== canonicalRoll.toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Unauthorized to delete this contribution' });
      }

      await sequelize.query(
        `DELETE FROM open_source_evidence WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.DELETE }
      );

      res.json({
        success: true,
        message: 'Contribution removed'
      });
    } catch (err) {
      console.error('[OPEN_SOURCE] Delete error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
