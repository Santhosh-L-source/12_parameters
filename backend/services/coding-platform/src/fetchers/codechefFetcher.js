const axios = require('../utils/axiosAdapter');
const cheerio = require('../utils/cheerioAdapter');
const config = require('../config/config');
const { withPage } = require('./browserPool');
const logger = require('../utils/logger');

async function fetchWithCheerio(handle) {
  const url = `https://www.codechef.com/users/${handle}`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': config.userAgent },
    timeout: 15000,
    maxRedirects: 0,
    validateStatus: (s) => s >= 200 && s < 400,
  });

  if (response.status >= 300) {
    throw new Error(`CodeChef user not found: ${handle}`);
  }

  const $ = cheerio.load(response.data);

  let totalSolved = 0;

  // Look for "Total Problems Solved: N" in any h3
  $('h3').each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/Total Problems Solved[:\s]*(\d+)/i);
    if (match) totalSolved = parseInt(match[1], 10);
  });

  // Fallback: last h3 in problems-solved section
  if (totalSolved === 0) {
    const problemsSection = $('.rating-data-section.problems-solved');
    if (problemsSection.length) {
      const h3s = problemsSection.find('h3');
      const lastH3 = h3s.last().text().trim();
      const match = lastH3.match(/(\d+)/);
      if (match) totalSolved = parseInt(match[0], 10);
    }
  }

  return totalSolved;
}

async function fetchWithPuppeteer(handle) {
  return withPage(async (page) => {
    await page.goto(`https://www.codechef.com/users/${handle}`, {
      waitUntil: 'networkidle2',
    });

    const stats = await page.evaluate(() => {
      let total = 0;

      // Look for "Total Problems Solved: N" in any h3
      document.querySelectorAll('h3').forEach((el) => {
        const match = el.textContent.match(/Total Problems Solved[:\s]*(\d+)/i);
        if (match) total = parseInt(match[1], 10);
      });

      // Fallback: text scan
      if (total === 0) {
        const text = document.body.innerText;
        const match = text.match(/Total Problems Solved[:\s]*(\d+)/i);
        if (match) total = parseInt(match[1], 10);
      }

      return { totalSolved: total };
    });

    return stats.totalSolved;
  });
}

async function fetchCodeChef(profileUrl) {
  const handle = config.platforms.CODECHEF.extractHandle(profileUrl);
  if (!handle) throw new Error(`Cannot extract CodeChef handle from: ${profileUrl}`);

  logger.info(`Fetching CodeChef stats for: ${handle}`);

  let totalSolved = 0;

  try {
    totalSolved = await fetchWithCheerio(handle);
  } catch (err) {
    if (err.message.includes('not found')) throw err;
    logger.info(`CodeChef Cheerio failed for ${handle}, falling back to Puppeteer: ${err.message}`);
    totalSolved = await fetchWithPuppeteer(handle);
  }

  logger.info(`CodeChef ${handle}: total=${totalSolved}, sql=0 (no SQL on platform)`);
  return { totalProblemsSolved: totalSolved, sqlProblemsSolved: 0 };
}

module.exports = { fetchCodeChef };
