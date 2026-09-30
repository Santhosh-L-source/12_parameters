const axios = require('../utils/axiosAdapter');
const cheerio = require('../utils/cheerioAdapter');
const config = require('../config/config');
const { withPage } = require('./browserPool');
const logger = require('../utils/logger');

async function fetchWithAPI(handle) {
  const urls = [
    `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${handle}`,
    `https://geeks-for-geeks-stats-api.vercel.app/?userName=${handle}`,
  ];

  for (const url of urls) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': config.userAgent },
        timeout: 15000,
      });

      const data = response.data?.data || response.data;
      if (data && (data.totalProblemsSolved || data.total_problems_solved)) {
        return {
          totalSolved: data.totalProblemsSolved || data.total_problems_solved || 0,
          sqlSolved: 0,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchWithPuppeteer(handle) {
  return withPage(async (page) => {
    await page.goto(`https://www.geeksforgeeks.org/user/${handle}/`, {
      waitUntil: 'domcontentloaded',
    });

    await page
      .waitForSelector(
        '[class*="scoreCard"], [class*="solvedProblem"], [class*="profile_head"]',
        { timeout: 10000 }
      )
      .catch(() => {});

    const stats = await page.evaluate(() => {
      let total = 0;
      let sql = 0;

      // Method 1: scoreCard section (newer GFG UI)
      const scoreCards = document.querySelectorAll(
        '[class*="scoreCard_head_left--score"], [class*="scoreCards"] [class*="score"]'
      );
      scoreCards.forEach((el) => {
        const val = parseInt(el.textContent.trim(), 10);
        if (!isNaN(val) && val > total) total = val;
      });

      // Method 2: solved problems container
      const solvedHeaders = document.querySelectorAll(
        '[class*="solvedProblemContainer"] [class*="head"]'
      );
      solvedHeaders.forEach((el) => {
        const text = el.textContent.trim();
        const match = text.match(/(\d+)/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > total) total = val;
        }
      });

      // Method 3: profile stats section
      if (total === 0) {
        document.querySelectorAll('[class*="profile"] [class*="stat"]').forEach((el) => {
          const text = el.textContent.trim().toLowerCase();
          if (text.includes('problem') || text.includes('solved')) {
            const match = text.match(/(\d+)/);
            if (match) total = parseInt(match[1], 10);
          }
        });
      }

      // Method 4: text content scan for "Total Problems Solved"
      if (total === 0) {
        const allText = document.body.innerText;
        const match = allText.match(/total\s+problems?\s+solved[:\s]*(\d+)/i);
        if (match) total = parseInt(match[1], 10);
      }

      return { totalSolved: total, sqlSolved: sql };
    });

    return stats;
  });
}

async function fetchGeeksforGeeks(profileUrl) {
  const handle = config.platforms.GEEKSFORGEEKS.extractHandle(profileUrl);
  if (!handle) throw new Error(`Cannot extract GeeksforGeeks handle from: ${profileUrl}`);

  logger.info(`Fetching GeeksforGeeks stats for: ${handle}`);

  let totalSolved = 0;
  let sqlSolved = 0;

  const apiResult = await fetchWithAPI(handle);
  if (apiResult && apiResult.totalSolved > 0) {
    totalSolved = apiResult.totalSolved;
    sqlSolved = apiResult.sqlSolved;
  } else {
    try {
      const puppeteerResult = await fetchWithPuppeteer(handle);
      totalSolved = puppeteerResult.totalSolved;
      sqlSolved = puppeteerResult.sqlSolved;
    } catch (err) {
      logger.warn(`GeeksforGeeks Puppeteer failed for ${handle}: ${err.message}`);
    }
  }

  logger.info(`GeeksforGeeks ${handle}: total=${totalSolved}, sql=${sqlSolved}`);
  return { totalProblemsSolved: totalSolved, sqlProblemsSolved: sqlSolved };
}

module.exports = { fetchGeeksforGeeks };
