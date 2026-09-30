const axios = require('../utils/axiosAdapter');
const config = require('../config/config');
const { withPage } = require('./browserPool');
const logger = require('../utils/logger');

async function fetchWithAPI(handle) {
  const url = `${config.platforms.CODEFORCES.apiBase}/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': config.userAgent },
    timeout: 15000,
  });

  if (response.data.status !== 'OK') {
    throw new Error(`Codeforces API error: ${response.data.comment || 'Unknown'}`);
  }

  const submissions = response.data.result || [];
  const solved = new Set();

  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      const key = `${sub.problem.contestId}-${sub.problem.index}`;
      solved.add(key);
    }
  }

  return solved.size;
}

async function fetchWithProfile(handle) {
  return withPage(async (page) => {
    await page.goto(
      `https://codeforces.com/profile/${encodeURIComponent(handle)}`,
      { waitUntil: 'networkidle2' }
    );

    await page
      .waitForSelector('div._UserActivityFrame_footer, div[class*="UserActivityFrame"]', {
        timeout: 10000,
      })
      .catch(() => {});

    const totalSolved = await page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/(\d+)\s+problems?\s*\n?\s*solved for all time/i);
      if (match) return parseInt(match[1], 10);

      const counters = document.querySelectorAll(
        'div[class*="_UserActivityFrame_counter"]'
      );
      for (const counter of counters) {
        const t = counter.innerText;
        if (t.includes('solved for all time')) {
          const m = t.match(/(\d+)/);
          if (m) return parseInt(m[1], 10);
        }
      }

      return 0;
    });

    return totalSolved;
  });
}

async function fetchCodeforces(profileUrl) {
  const handle = config.platforms.CODEFORCES.extractHandle(profileUrl);
  if (!handle) throw new Error(`Cannot extract Codeforces handle from: ${profileUrl}`);

  logger.info(`Fetching Codeforces stats for: ${handle}`);

  let totalSolved = 0;

  try {
    totalSolved = await fetchWithProfile(handle);
    if (totalSolved > 0) {
      logger.info(`Codeforces ${handle}: total=${totalSolved} (profile), sql=0`);
      return { totalProblemsSolved: totalSolved, sqlProblemsSolved: 0 };
    }
  } catch (err) {
    logger.warn(`Codeforces profile scrape failed for ${handle}: ${err.message}`);
  }

  totalSolved = await fetchWithAPI(handle);

  logger.info(`Codeforces ${handle}: total=${totalSolved} (API), sql=0`);
  return { totalProblemsSolved: totalSolved, sqlProblemsSolved: 0 };
}

module.exports = { fetchCodeforces };
