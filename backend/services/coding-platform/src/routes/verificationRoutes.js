const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const CodingEvidence = require('../models/CodingEvidence');
const VerificationAttempt = require('../models/VerificationAttempt');
const config = require('../config/config');
const platformConfig = require('../config/config');
const { getVerificationStrategy, isVerificationSupported, VERIFICATION_STRATEGIES } = require('../config/platformVerification');
const logger = require('../utils/logger');

const router = Router();

const VALID_PLATFORMS = [
  'LEETCODE', 'CODEFORCES', 'ATCODER', 'CODECHEF',
  'HACKERRANK', 'GEEKSFORGEEKS', 'SKILLRACK',
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

function generateToken(rollNumber) {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
  return `VERIFY-${rollNumber}-${random}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function extractHandle(platform, profileUrl) {
  const platConf = platformConfig.platforms[platform];
  if (!platConf) return null;
  if (platConf.extractHandle) return platConf.extractHandle(profileUrl);
  if (platConf.extractId) {
    const result = platConf.extractId(profileUrl);
    return result ? result.id : null;
  }
  return null;
}

// GET /api/verification/platforms — list verification support per platform
router.get('/platforms', requireAuth, (req, res) => {
  const platforms = {};
  for (const p of VALID_PLATFORMS) {
    const strategy = VERIFICATION_STRATEGIES[p];
    platforms[p] = {
      supported: strategy?.supported || false,
      reason: strategy?.reason || null,
      fieldName: strategy?.fieldName || null,
      instructions: strategy?.instructions || null,
    };
  }
  res.json({ platforms });
});

// POST /api/verification/start — generate a verification token
router.post(
  '/start',
  requireAuth,
  [
    body('platform').isIn(VALID_PLATFORMS).withMessage('Invalid platform'),
    body('profileUrl').isURL().withMessage('Valid profile URL required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { platform, profileUrl } = req.body;
      const student = req.student;

      if (!isVerificationSupported(platform)) {
        const strategy = getVerificationStrategy(platform);
        return res.status(400).json({
          error: 'Verification not supported',
          reason: strategy?.reason || 'This platform does not support automated verification.',
        });
      }

      const handle = extractHandle(platform, profileUrl);
      if (!handle) {
        return res.status(400).json({ error: 'Cannot extract username from the provided URL' });
      }

      // Check if this external account is already verified by another student
      const existingLink = await CodingEvidence.findOne({
        where: {
          platform,
          externalUsername: handle,
          verified: true,
          studentId: { [Op.ne]: student.rollNumber },
        },
      });
      if (existingLink) {
        return res.status(409).json({
          error: 'This external account is already linked to another student',
        });
      }

      // Rate limit: max N attempts per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentAttempts = await VerificationAttempt.count({
        where: {
          studentId: student.id,
          createdAt: { [Op.gte]: oneHourAgo },
        },
      });
      if (recentAttempts >= config.verification.maxAttemptsPerHour) {
        return res.status(429).json({
          error: 'Too many verification attempts. Please try again later.',
        });
      }

      // Expire any existing PENDING attempts for this student+platform
      await VerificationAttempt.update(
        { status: 'EXPIRED' },
        {
          where: {
            studentId: student.id,
            platform,
            status: 'PENDING',
          },
        }
      );

      // Generate token
      const rawToken = generateToken(student.rollNumber);
      const tokenH = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + config.verification.tokenExpiryMinutes * 60 * 1000);

      const attempt = await VerificationAttempt.create({
        studentId: student.id,
        platform,
        profileUrl,
        externalUsername: handle,
        tokenHash: tokenH,
        expiresAt,
        status: 'PENDING',
      });

      const strategy = getVerificationStrategy(platform);
      logger.info(`Verification started: student=${student.rollNumber} platform=${platform} handle=${handle}`);

      res.json({
        attemptId: attempt.id,
        token: rawToken,
        expiresAt,
        expiresInMinutes: config.verification.tokenExpiryMinutes,
        platform,
        handle,
        fieldName: strategy.fieldName,
        instructions: strategy.instructions,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/verification/check — verify the token on the external profile
router.post(
  '/check',
  requireAuth,
  [
    body('attemptId').isInt().withMessage('attemptId is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { attemptId } = req.body;
      const student = req.student;

      const attempt = await VerificationAttempt.findByPk(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: 'Verification attempt not found' });
      }

      // Ensure token belongs to authenticated student
      if (attempt.studentId !== student.id) {
        return res.status(403).json({ error: 'This verification does not belong to you' });
      }

      if (attempt.status !== 'PENDING') {
        return res.status(400).json({
          error: `Verification already ${attempt.status.toLowerCase()}. Start a new one.`,
        });
      }

      // Check expiry
      if (new Date() > new Date(attempt.expiresAt)) {
        attempt.status = 'EXPIRED';
        await attempt.save();
        return res.status(400).json({ error: 'Verification token has expired. Please start again.' });
      }

      // Check if external account got linked to another student while pending
      const existingLink = await CodingEvidence.findOne({
        where: {
          platform: attempt.platform,
          externalUsername: attempt.externalUsername,
          verified: true,
          studentId: { [Op.ne]: student.rollNumber },
        },
      });
      if (existingLink) {
        attempt.status = 'FAILED';
        await attempt.save();
        return res.status(409).json({
          error: 'This external account is already linked to another student',
        });
      }

      // Reconstruct the token from the hash to check against profile
      // We need to search for the token pattern on the profile
      // Since we stored a hash, we need to look for VERIFY-{rollNumber}-* pattern and match hash
      const strategy = getVerificationStrategy(attempt.platform);
      if (!strategy || !strategy.supported) {
        return res.status(400).json({ error: 'Verification not supported for this platform' });
      }

      // Fetch the field and search for our token pattern
      let foundToken = false;
      try {
        foundToken = await checkProfileForToken(
          attempt.platform,
          attempt.externalUsername,
          attempt.profileUrl,
          student.rollNumber,
          attempt.tokenHash
        );
      } catch (fetchErr) {
        logger.warn(`Verification check failed for ${attempt.platform}/${attempt.externalUsername}: ${fetchErr.message}`);
        attempt.status = 'FAILED';
        await attempt.save();
        return res.status(400).json({
          error: 'Could not fetch the external profile. Please make sure the profile exists and try again.',
        });
      }

      if (!foundToken) {
        attempt.status = 'FAILED';
        await attempt.save();
        logger.info(`Verification failed: student=${student.rollNumber} platform=${attempt.platform}`);
        return res.status(400).json({
          error: 'Verification failed. We could not find the verification code on your profile. Make sure you added the exact code, saved your profile, and try again.',
        });
      }

      // All checks passed — mark verified
      attempt.status = 'VERIFIED';
      attempt.verifiedAt = new Date();
      await attempt.save();

      // Update or create the CodingEvidence record
      let evidence = await CodingEvidence.findOne({
        where: { studentId: student.rollNumber, platform: attempt.platform },
      });

      if (evidence) {
        evidence.verified = true;
        evidence.verifiedAt = new Date();
        evidence.externalUsername = attempt.externalUsername;
        evidence.profileUrl = attempt.profileUrl;
        await evidence.save();
      } else {
        evidence = await CodingEvidence.create({
          studentId: student.rollNumber,
          semester: 1,
          platform: attempt.platform,
          profileUrl: attempt.profileUrl,
          externalUsername: attempt.externalUsername,
          verified: true,
          verifiedAt: new Date(),
          status: 'PENDING',
        });
      }

      logger.info(`Verification succeeded: student=${student.rollNumber} platform=${attempt.platform} handle=${attempt.externalUsername}`);

      res.json({
        message: 'Profile verified successfully',
        verified: true,
        evidence: evidence.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/verification/status/:platform — check verification status
router.get(
  '/status/:platform',
  requireAuth,
  [param('platform').isIn(VALID_PLATFORMS)],
  validate,
  async (req, res, next) => {
    try {
      const { platform } = req.params;
      const student = req.student;

      const evidence = await CodingEvidence.findOne({
        where: { studentId: student.rollNumber, platform },
      });

      const pendingAttempt = await VerificationAttempt.findOne({
        where: {
          studentId: student.id,
          platform,
          status: 'PENDING',
          expiresAt: { [Op.gt]: new Date() },
        },
        order: [['createdAt', 'DESC']],
      });

      res.json({
        platform,
        verified: evidence?.verified || false,
        verifiedAt: evidence?.verifiedAt || null,
        externalUsername: evidence?.externalUsername || null,
        hasPendingAttempt: !!pendingAttempt,
        verificationSupported: isVerificationSupported(platform),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/verification/remove/:platform — unlink a verified profile
router.post(
  '/remove/:platform',
  requireAuth,
  [param('platform').isIn(VALID_PLATFORMS)],
  validate,
  async (req, res, next) => {
    try {
      const { platform } = req.params;
      const student = req.student;

      const evidence = await CodingEvidence.findOne({
        where: { studentId: student.rollNumber, platform },
      });

      if (!evidence) {
        return res.status(404).json({ error: 'No linked profile found' });
      }

      evidence.verified = false;
      evidence.verifiedAt = null;
      evidence.externalUsername = null;
      await evidence.save();

      logger.info(`Profile unlinked: student=${student.rollNumber} platform=${platform}`);

      res.json({ message: 'Profile unlinked. Re-verification required to link again.' });
    } catch (error) {
      next(error);
    }
  }
);

// Helper: fetch profile field and check for verification token
async function checkProfileForToken(platform, username, profileUrl, rollNumber, storedTokenHash) {
  const axios = require('axios');
  const cheerio = require('cheerio');
  const { withPage } = require('../fetchers/browserPool');
  const prefix = `VERIFY-${rollNumber}-`;
  let fieldContent = '';

  // Use the identifier based on platform
  const identifier = platform === 'SKILLRACK' ? profileUrl : username;

  if (platform === 'LEETCODE') {
    const res = await axios.post(
      'https://leetcode.com/graphql',
      {
        query: `query { matchedUser(username: "${username.replace(/"/g, '')}") { profile { aboutMe } } }`,
      },
      {
        headers: { 'Content-Type': 'application/json', 'User-Agent': config.userAgent },
        timeout: 15000,
      }
    );
    fieldContent = res.data?.data?.matchedUser?.profile?.aboutMe || '';
  } else if (platform === 'CODEFORCES') {
    const res = await axios.get(
      `https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`,
      { headers: { 'User-Agent': config.userAgent }, timeout: 15000 }
    );
    if (res.data.status !== 'OK' || !res.data.result?.length) {
      throw new Error('User not found');
    }
    const user = res.data.result[0];
    fieldContent = [user.firstName, user.lastName, user.organization].filter(Boolean).join(' ');
  } else if (platform === 'GEEKSFORGEEKS') {
    const res = await axios.get(
      `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${encodeURIComponent(username)}`,
      { headers: { 'User-Agent': config.userAgent }, timeout: 15000 }
    );
    const data = res.data?.data;
    if (!data) throw new Error('User not found');
    fieldContent = [data.institute_name, data.organization_name, data.school, data.name, data.designation].filter(Boolean).join(' ');
  } else if (platform === 'ATCODER') {
    const res = await axios.get(
      `https://atcoder.jp/users/${encodeURIComponent(username)}`,
      { headers: { 'User-Agent': config.userAgent }, timeout: 15000 }
    );
    const $ = cheerio.load(res.data);
    $('table tr').each((i, el) => {
      const th = $(el).find('th').text().trim();
      const td = $(el).find('td').text().trim();
      if (th === 'Affiliation') {
        fieldContent = td;
      }
    });
  } else if (platform === 'HACKERRANK') {
    // Use Puppeteer to extract name field - wait for JS to render
    fieldContent = await withPage(async (page) => {
      // Set stealth mode
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      try {
        await page.goto(`https://www.hackerrank.com/profile/${encodeURIComponent(username)}`, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });
      } catch (err) {
        // Try alternate URL for HackerRank
        await page.goto(`https://www.hackerrank.com/${encodeURIComponent(username)}`, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });
      }

      // Wait for profile content to load (wait for any h1 or profile element)
      try {
        await page.waitForSelector('h1, .profile-heading, [class*="profile"]', { timeout: 10000 });
      } catch (e) {
        // Continue even if selector not found
      }

      // Wait a bit more for JS to fully render
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract name from the profile page
      return await page.evaluate(() => {
        // Try to find the name element
        const nameSelectors = [
          'h1.profile-heading',
          '.hacker-name',
          'h1',
          '.profile-name',
          '[class*="ProfileHeading"]',
          '[class*="profile-name"]'
        ];

        for (const selector of nameSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim() && element.textContent.trim().length > 2) {
            return element.textContent.trim();
          }
        }

        // Fallback: return all text content
        return document.body.innerText;
      });
    });
  } else if (platform === 'CODECHEF' || platform === 'SKILLRACK') {
    // Use Puppeteer for dynamic content
    fieldContent = await withPage(async (page) => {
      let url = profileUrl;
      if (platform === 'CODECHEF') {
        url = `https://www.codechef.com/users/${encodeURIComponent(username)}`;
      }

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      return await page.evaluate(() => document.body.innerText);
    });
  } else {
    throw new Error(`Verification not supported for ${platform}`);
  }

  // Search for VERIFY-{ROLLNUMBER}-XXXXX pattern
  const regex = new RegExp(`VERIFY-${rollNumber}-[A-Z0-9]{5}`, 'g');
  const matches = fieldContent.match(regex);
  if (!matches || matches.length === 0) {
    return false;
  }

  // Check if any found token matches our stored hash
  for (const candidateToken of matches) {
    const candidateHash = hashToken(candidateToken);
    if (candidateHash === storedTokenHash) {
      return true;
    }
  }

  return false;
}

module.exports = router;
