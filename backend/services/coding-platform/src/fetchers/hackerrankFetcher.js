const axios = require('../utils/axiosAdapter');
const config = require('../config/config');
const { withPage } = require('./browserPool');
const logger = require('../utils/logger');

async function fetchWithAPI(handle) {
  // Use badges endpoint (more reliable)
  const badgesRes = await axios
    .get(`${config.platforms.HACKERRANK.apiBase}/${handle}/badges`, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 15000,
    })
    .catch(() => null);

  if (!badgesRes || badgesRes.status === 404) {
    throw new Error(
      'HackerRank public profiles are no longer accessible. ' +
      'HackerRank has removed their public API and profile pages.'
    );
  }

  let totalStars = 0;
  let sqlStars = 0;

  if (badgesRes?.data?.models) {
    for (const badge of badgesRes.data.models) {
      const stars = parseInt(badge.stars, 10) || 0;
      totalStars += stars;

      // Check if this is SQL badge
      if (badge.badge_name?.toLowerCase().includes('sql') ||
          badge.badge_type?.toLowerCase() === 'sql') {
        sqlStars = stars;
      }
    }
  }

  // Each star represents approximately 10 problems solved
  // This is how HackerRank's star system works
  const totalSolved = totalStars * 10;
  const sqlSolved = sqlStars * 10;

  return { totalSolved, sqlSolved };
}

async function fetchWithPuppeteer(handle) {
  return withPage(async (page) => {
    await page.goto(`https://www.hackerrank.com/profile/${handle}`, {
      waitUntil: 'networkidle2',
    });

    await page.waitForSelector('.hacker-badge, .profile-sidebar, .badges-list', {
      timeout: 10000,
    }).catch(() => {});

    const stats = await page.evaluate(() => {
      let total = 0;
      let sql = 0;

      // Look for badge counts
      document.querySelectorAll('.hacker-badge, .badge-title, [class*="badge"]').forEach((el) => {
        const text = el.textContent.trim();
        const starMatch = text.match(/(\d+)\s*star/i);
        if (starMatch) {
          total += parseInt(starMatch[1], 10) * 10;
        }
        if (/sql/i.test(text)) {
          const numMatch = text.match(/(\d+)/);
          if (numMatch) sql = parseInt(numMatch[1], 10) * 10;
        }
      });

      // Look for solved challenges count
      document
        .querySelectorAll('.profile-sidebar-stat, [class*="challenges-solved"]')
        .forEach((el) => {
          const numMatch = el.textContent.match(/(\d+)/);
          if (numMatch) {
            const val = parseInt(numMatch[0], 10);
            if (val > total) total = val;
          }
        });

      return { totalSolved: total, sqlSolved: sql };
    });

    return stats;
  });
}

async function fetchHackerRank(profileUrl) {
  const handle = config.platforms.HACKERRANK.extractHandle(profileUrl);
  if (!handle) throw new Error(`Cannot extract HackerRank handle from: ${profileUrl}`);

  logger.info(`Fetching HackerRank stats for: ${handle}`);

  let totalSolved = 0;
  let sqlSolved = 0;

  try {
    const apiResult = await fetchWithAPI(handle);
    totalSolved = apiResult.totalSolved;
    sqlSolved = apiResult.sqlSolved;
  } catch (err) {
    if (err.message.includes('no longer accessible')) throw err;
    logger.info(
      `HackerRank API failed for ${handle}, falling back to Puppeteer: ${err.message}`
    );
    try {
      const puppeteerResult = await fetchWithPuppeteer(handle);
      totalSolved = puppeteerResult.totalSolved;
      sqlSolved = puppeteerResult.sqlSolved;
    } catch (puppeteerErr) {
      logger.warn(`HackerRank Puppeteer also failed for ${handle}: ${puppeteerErr.message}`);
    }
  }

  logger.info(`HackerRank ${handle}: total=${totalSolved}, sql=${sqlSolved}`);
  return { totalProblemsSolved: totalSolved, sqlProblemsSolved: sqlSolved };
}

module.exports = { fetchHackerRank };
