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
 *
 * Fully automated with Anti-Fraud Protection:
 * - 1:1 Student to GitHub account binding (cannot claim other students' accounts)
 * - Repository PR filtering by student's author handle
 * - Live auto-fetch & auto-allotment of marks
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');
const { fetchGitHubOpenSourceStats, parseGitHubInput, verifyGitHubOwnership } = require('../../../services/coding-platform/src/fetchers/githubOpenSourceFetcher');

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
 * Calculate stage for a single repo/programme based on contribution metrics
 * Returns highest stage achieved
 */
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
 * Recalculate marks and update scores table
 */
async function recalculateAndSaveScore(studentId) {
  const allEvidence = await sequelize.query(
    `SELECT distinct_key_normalized,
            MAX(prs_submitted) as prs_submitted,
            MAX(prs_merged) as prs_merged,
            BOOL_OR(programme_selected) as programme_selected,
            BOOL_OR(is_maintainer) as is_maintainer,
            BOOL_OR(programme_completed) as programme_completed
     FROM open_source_evidence
     WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) AND status = 'VERIFIED'
     GROUP BY distinct_key_normalized`,
    {
      replacements: { studentId },
      type: sequelize.QueryTypes.SELECT
    }
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

  await sequelize.query(
    `DELETE FROM scores WHERE LOWER(TRIM(register_number)) = LOWER(TRIM(:studentId)) AND parameter = 'opensource'`,
    { replacements: { studentId }, type: sequelize.QueryTypes.DELETE }
  );

  if (finalMarks > 0) {
    await sequelize.query(
      `INSERT INTO scores (register_number, parameter, marks, semester, provisional, calculated_at)
       VALUES (:studentId, 'opensource', :marks, 1, false, NOW())`,
      { replacements: { studentId, marks: finalMarks }, type: sequelize.QueryTypes.INSERT }
    );
  }

  return finalMarks;
}

/**
 * POST /api/open-source/verify-ownership
 * Anti-Fraud Step 1: Verify GitHub profile ownership via token in bio before linking
 */
router.post(
  '/verify-ownership',
  authenticate,
  [
    body('github_url').optional().isString(),
    body('github_username').optional().isString(),
    body('token').notEmpty().withMessage('Verification token is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const targetInput = req.body.github_url || req.body.github_username;
      const { token } = req.body;

      if (!targetInput || !targetInput.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Missing Input',
          message: 'Please provide a GitHub profile URL or username',
        });
      }

      const parsed = parseGitHubInput(targetInput);
      const username = parsed.username;

      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Invalid GitHub Handle',
          message: 'Could not extract a valid GitHub username from the input',
        });
      }

      // 1. Check if another student has already claimed this GitHub username
      const claimedByOther = await sequelize.query(
        `SELECT student_id FROM open_source_evidence 
         WHERE LOWER(TRIM(github_username)) = LOWER(TRIM(:username))
           AND LOWER(TRIM(student_id)) != LOWER(TRIM(:studentId))
         LIMIT 1`,
        { replacements: { username, studentId }, type: sequelize.QueryTypes.SELECT }
      );

      if (claimedByOther.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Account Already Claimed',
          message: `The GitHub username @${username} is already bound to student ${claimedByOther[0].student_id}. Multiple students cannot share the same GitHub account.`,
        });
      }

      // 2. Perform live verification by scraping the profile bio / text for token
      const verifyResult = await verifyGitHubOwnership(username, token);
      if (!verifyResult.verified) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: 'Ownership Verification Failed',
          message: verifyResult.reason || `Verification token "${token}" was not found in @${username}'s GitHub bio. Please make sure you saved it to your GitHub bio and try again.`,
        });
      }

      // 3. Ownership confirmed! Live fetch user's PR metrics
      const fetched = await fetchGitHubOpenSourceStats(username);
      const distinct_key = fetched.repo_name || `${username}/contributions`;

      // 4. Upsert evidence record
      const existing = await sequelize.query(
        `SELECT id FROM open_source_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) 
           AND (distinct_key_normalized = lower(trim(:distinct_key)) OR github_username = :username)`,
        { replacements: { studentId, distinct_key, username }, type: sequelize.QueryTypes.SELECT }
      );

      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE open_source_evidence
           SET github_username = :username,
               repo_name = :repo_name,
               prs_submitted = :prs_submitted,
               prs_merged = :prs_merged,
               is_maintainer = :is_maintainer,
               repo_url = :repo_url,
               evidence_urls = :evidence_urls,
               fetch_method = 'GITHUB_API',
               status = 'VERIFIED',
               verified_at = NOW(),
               last_fetched_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              username,
              repo_name: fetched.repo_name,
              prs_submitted: fetched.prs_submitted,
              prs_merged: fetched.prs_merged,
              is_maintainer: fetched.is_maintainer,
              repo_url: fetched.repo_url,
              evidence_urls: fetched.evidence_urls && fetched.evidence_urls.length > 0 ? `{${fetched.evidence_urls.join(',')}}` : null
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        await sequelize.query(
          `INSERT INTO open_source_evidence
           (student_id, github_username, repo_name, distinct_key,
            prs_submitted, prs_merged, programme_selected, is_maintainer, programme_completed,
            repo_url, evidence_urls, fetch_method, status, submitted_at, verified_at, last_fetched_at)
           VALUES (:studentId, :username, :repo_name, :distinct_key,
                   :prs_submitted, :prs_merged, false, :is_maintainer, false,
                   :repo_url, :evidence_urls, 'GITHUB_API', 'VERIFIED', NOW(), NOW(), NOW())`,
          {
            replacements: {
              studentId,
              username,
              repo_name: fetched.repo_name,
              distinct_key,
              prs_submitted: fetched.prs_submitted,
              prs_merged: fetched.prs_merged,
              is_maintainer: fetched.is_maintainer,
              repo_url: fetched.repo_url,
              evidence_urls: fetched.evidence_urls && fetched.evidence_urls.length > 0 ? `{${fetched.evidence_urls.join(',')}}` : null
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      // 5. Recalculate marks and update scores table
      const totalMarks = await recalculateAndSaveScore(studentId);
      const stageMarks = calculateStage(fetched.prs_submitted, fetched.prs_merged, false, fetched.is_maintainer, false);

      return res.json({
        success: true,
        verified: true,
        message: `GitHub account @${username} verified and linked! Stage marks: ${stageMarks}, Total marks: ${totalMarks}/20`,
        marks: totalMarks,
        stats: {
          ...fetched,
          stage_marks: stageMarks,
          total_marks: totalMarks,
        }
      });
    } catch (err) {
      console.error('[OPEN_SOURCE] Verify ownership error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/open-source/submit
 * Automated: User gives GitHub URL -> Anti-Fraud validation -> Auto-fetches live metrics -> Verifies & allots marks
 */
router.post(
  '/submit',
  authenticate,
  [
    body('github_url').optional().isString(),
    body('github_username').optional().isString(),
    body('repo_url').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const targetInput = req.body.github_url || req.body.repo_url || req.body.github_username;

      if (!targetInput || !targetInput.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid data',
          message: 'Please provide a GitHub profile or repository URL'
        });
      }

      // 1. Check if student already has a primary bound GitHub account
      const studentPrimary = await sequelize.query(
        `SELECT DISTINCT github_username FROM open_source_evidence 
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId))
         LIMIT 1`,
        { replacements: { studentId }, type: sequelize.QueryTypes.SELECT }
      );

      const boundUser = studentPrimary.length > 0 ? studentPrimary[0].github_username : null;

      // 2. Auto-fetch details and live metrics from GitHub
      let fetched;
      try {
        fetched = await fetchGitHubOpenSourceStats(targetInput.trim(), boundUser);
      } catch (fetchErr) {
        return res.status(400).json({
          success: false,
          error: 'GitHub Fetch Error',
          message: fetchErr.message || 'Unable to fetch GitHub metrics for the provided URL'
        });
      }

      const {
        github_username,
        repo_name,
        repo_url,
        prs_submitted = 0,
        prs_merged = 0,
        is_maintainer = false,
        programme_selected = false,
        programme_completed = false,
        evidence_urls = [],
      } = fetched;

      // 3. Anti-Fraud Rule A: Prevent claiming a different GitHub user's account
      if (boundUser && boundUser.toLowerCase() !== github_username.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'Account Mismatch',
          message: `Your profile is linked to GitHub username @${boundUser}. You cannot claim contributions from a different GitHub account (@${github_username}). Please delete existing contributions first if you want to link a different account.`
        });
      }

      // 4. Anti-Fraud Rule B: Prevent 2 different students from claiming the same GitHub account
      const claimedByOther = await sequelize.query(
        `SELECT student_id FROM open_source_evidence 
         WHERE LOWER(TRIM(github_username)) = LOWER(TRIM(:github_username))
           AND LOWER(TRIM(student_id)) != LOWER(TRIM(:studentId))
         LIMIT 1`,
        { replacements: { github_username, studentId }, type: sequelize.QueryTypes.SELECT }
      );

      if (claimedByOther.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Account Already Claimed',
          message: `The GitHub username @${github_username} is already registered by student ${claimedByOther[0].student_id}. Multiple students cannot share the same GitHub account.`
        });
      }

      const distinct_key = repo_name || `${github_username}/contributions`;

      // Check if contribution already exists
      const existing = await sequelize.query(
        `SELECT id, status FROM open_source_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId)) 
           AND (distinct_key_normalized = lower(trim(:distinct_key)) OR github_username = :github_username)`,
        {
          replacements: { studentId, distinct_key, github_username },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let isUpdate = false;
      let recordId;

      if (existing.length > 0) {
        isUpdate = true;
        recordId = existing[0].id;
        await sequelize.query(
          `UPDATE open_source_evidence
           SET github_username = :github_username,
               repo_name = :repo_name,
               prs_submitted = :prs_submitted,
               prs_merged = :prs_merged,
               programme_selected = :programme_selected,
               is_maintainer = :is_maintainer,
               programme_completed = :programme_completed,
               repo_url = :repo_url,
               evidence_urls = :evidence_urls,
               fetch_method = 'GITHUB_API',
               status = 'VERIFIED',
               submitted_at = NOW(),
               verified_at = NOW(),
               last_fetched_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: recordId,
              github_username,
              repo_name,
              prs_submitted,
              prs_merged,
              programme_selected,
              is_maintainer,
              programme_completed,
              repo_url,
              evidence_urls: evidence_urls && evidence_urls.length > 0 ? `{${evidence_urls.join(',')}}` : null
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        const result = await sequelize.query(
          `INSERT INTO open_source_evidence
           (student_id, github_username, repo_name, distinct_key,
            prs_submitted, prs_merged, programme_selected, is_maintainer, programme_completed,
            repo_url, evidence_urls, fetch_method, status, submitted_at, verified_at, last_fetched_at)
           VALUES (:studentId, :github_username, :repo_name, :distinct_key,
                   :prs_submitted, :prs_merged, :programme_selected, :is_maintainer, :programme_completed,
                   :repo_url, :evidence_urls, 'GITHUB_API', 'VERIFIED', NOW(), NOW(), NOW())
           RETURNING id`,
          {
            replacements: {
              studentId,
              github_username,
              repo_name,
              distinct_key,
              prs_submitted,
              prs_merged,
              programme_selected,
              is_maintainer,
              programme_completed,
              repo_url,
              evidence_urls: evidence_urls && evidence_urls.length > 0 ? `{${evidence_urls.join(',')}}` : null
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
        recordId = result[0][0]?.id;
      }

      // Automatically recalculate and allot marks
      const totalMarks = await recalculateAndSaveScore(studentId);
      const stageMarks = calculateStage(prs_submitted, prs_merged, programme_selected, is_maintainer, programme_completed);

      res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: `GitHub details fetched & verified! Stage marks: ${stageMarks}, Total marks: ${totalMarks}/20`,
        is_update: isUpdate,
        stats: {
          github_username,
          repo_name,
          prs_submitted,
          prs_merged,
          is_maintainer,
          stage_marks: stageMarks,
          total_marks: totalMarks
        }
      });

    } catch (err) {
      console.error('[OPEN_SOURCE] Submit error:', err.message);
      next(err);
    }
  }
);

/**
 * DELETE /api/open-source/:id
 * Delete a contribution and recalculate marks
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;
      const { id } = req.params;

      const existing = await sequelize.query(
        `SELECT * FROM open_source_evidence WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.SELECT }
      );

      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Contribution not found' });
      }

      if (req.user.role !== 'admin' && req.user.role !== 'mentor' && existing[0].student_id.toLowerCase() !== studentId.toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Unauthorized to delete this contribution' });
      }

      await sequelize.query(
        `DELETE FROM open_source_evidence WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.DELETE }
      );

      const updatedMarks = await recalculateAndSaveScore(existing[0].student_id);

      res.json({
        success: true,
        message: 'Contribution removed and marks updated',
        marks: updatedMarks
      });
    } catch (err) {
      console.error('[OPEN_SOURCE] Delete error:', err.message);
      next(err);
    }
  }
);

/**
 * POST /api/open-source/sync
 * Trigger live re-sync of student's open source contributions
 */
router.post(
  '/sync',
  authenticate,
  async (req, res, next) => {
    try {
      const studentId = req.user.roll_number;

      const existingEvidence = await sequelize.query(
        `SELECT * FROM open_source_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId))`,
        { replacements: { studentId }, type: sequelize.QueryTypes.SELECT }
      );

      for (const item of existingEvidence) {
        const target = item.repo_url || item.github_username;
        if (target) {
          try {
            const fetched = await fetchGitHubOpenSourceStats(target, item.github_username);
            await sequelize.query(
              `UPDATE open_source_evidence
               SET prs_submitted = :prs_submitted,
                   prs_merged = :prs_merged,
                   is_maintainer = :is_maintainer,
                   status = 'VERIFIED',
                   verified_at = NOW(),
                   last_fetched_at = NOW()
               WHERE id = :id`,
              {
                replacements: {
                  id: item.id,
                  prs_submitted: fetched.prs_submitted,
                  prs_merged: fetched.prs_merged,
                  is_maintainer: fetched.is_maintainer
                },
                type: sequelize.QueryTypes.UPDATE
              }
            );
          } catch (e) {
            console.warn(`[OPEN_SOURCE] Sync warning for item ${item.id}:`, e.message);
          }
        }
      }

      const finalMarks = await recalculateAndSaveScore(studentId);

      const updated = await sequelize.query(
        `SELECT * FROM open_source_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId))
         ORDER BY submitted_at DESC`,
        { replacements: { studentId }, type: sequelize.QueryTypes.SELECT }
      );

      res.json({
        success: true,
        message: 'Open source contributions synced with GitHub!',
        marks: finalMarks,
        evidence: updated || []
      });
    } catch (err) {
      console.error('[OPEN_SOURCE] Sync error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/open-source/student/:studentId
 * Get all open source evidence for a student
 */
router.get(
  '/student/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;

      if (req.user.roll_number?.toLowerCase() !== studentId?.toLowerCase() && req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only view your own evidence'
        });
      }

      const evidence = await sequelize.query(
        `SELECT * FROM open_source_evidence
         WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(:studentId))
         ORDER BY submitted_at DESC`,
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
      console.error('[OPEN_SOURCE] Get evidence error:', err.message);
      next(err);
    }
  }
);

/**
 * GET /api/open-source/marks/:studentId
 * Calculate marks: MAX stage per repo, SUM across repos, cap at 20
 */
router.get(
  '/marks/:studentId',
  authenticate,
  [param('studentId').notEmpty().withMessage('studentId is required')],
  validate,
  async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const cleanId = String(studentId).trim();

      // 1. Check scores table first
      const scoreRows = await sequelize.query(
        `SELECT marks FROM scores 
         WHERE (LOWER(roll_number) = LOWER(:cleanId) OR LOWER(roll_number) IN (
           SELECT LOWER(roll_number) FROM students WHERE LOWER(register_number) = LOWER(:cleanId)
         ))
         AND parameter_id IN ('opensource', 'open_source', 'oss')
         ORDER BY marks DESC LIMIT 1`,
        {
          replacements: { cleanId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (scoreRows && scoreRows.length > 0 && parseFloat(scoreRows[0].marks) > 0) {
        return res.json({
          success: true,
          student_id: cleanId,
          marks: parseFloat(scoreRows[0].marks),
          max_marks: 20
        });
      }

      // 2. Check open_source_evidence
      const allEvidence = await sequelize.query(
        `SELECT distinct_key_normalized,
                repo_name,
                github_username,
                repo_url,
                MAX(prs_submitted) as prs_submitted,
                MAX(prs_merged) as prs_merged,
                BOOL_OR(is_maintainer) as is_maintainer
         FROM open_source_evidence
         WHERE (LOWER(roll_number) = LOWER(:cleanId) OR LOWER(roll_number) IN (
           SELECT LOWER(roll_number) FROM students WHERE LOWER(register_number) = LOWER(:cleanId)
         )) AND status = 'VERIFIED'
         GROUP BY distinct_key_normalized, repo_name, github_username, repo_url`,
        {
          replacements: { cleanId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      let uncappedTotal = 0;
      (allEvidence || []).forEach(e => {
        const stage = calculateStage(
          e.prs_submitted || 0,
          e.prs_merged || 0,
          false,
          e.is_maintainer || false,
          false
        );
        uncappedTotal += stage;
      });

      const finalMarks = Math.min(20, uncappedTotal);

      res.json({
        success: true,
        student_id: cleanId,
        marks: finalMarks,
        max_marks: 20,
        uncapped_total: uncappedTotal,
        repos_count: allEvidence ? allEvidence.length : 0
      });

    } catch (err) {
      console.error('[OPEN_SOURCE] Calculate marks error:', err.message);
      next(err);
    }
  }
);

module.exports = router;
