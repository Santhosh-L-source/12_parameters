const axios = require('../utils/axiosAdapter');
const config = require('../config/config');
const logger = require('../utils/logger');

function parseCodeChefHtml(html) {
  let totalSolved = 0;

  // Pattern 1: "Total Problems Solved: 90" or "Total Problems Solved : 90"
  const m1 = html.match(/Total\s+Problems\s+Solved[:\s]*(\d+)/i);
  if (m1) {
    totalSolved = parseInt(m1[1], 10);
  }

  // Pattern 2: problems-solved section
  if (totalSolved === 0) {
    const m2 = html.match(/problems-solved[\s\S]*?<h3>\s*(\d+)/i);
    if (m2) {
      totalSolved = parseInt(m2[1], 10);
    }
  }

  // Pattern 3: Fully Solved (90)
  if (totalSolved === 0) {
    const m3 = html.match(/Fully\s+Solved\s*\(\s*(\d+)\s*\)/i);
    if (m3) {
      totalSolved = parseInt(m3[1], 10);
    }
  }

  // Pattern 4: Any h3 containing solved count
  if (totalSolved === 0) {
    const h3Matches = html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi);
    for (const match of h3Matches) {
      const text = match[1].replace(/<[^>]+>/g, ' ').trim();
      const m = text.match(/Total\s+Problems\s+Solved[:\s]*(\d+)/i) || text.match(/(\d+)/);
      if (m && text.toLowerCase().includes('solved')) {
        const val = parseInt(m[1], 10);
        if (val > totalSolved) totalSolved = val;
      }
    }
  }

  return totalSolved;
}

async function fetchCodeChef(profileUrl) {
  const handle = config.platforms.CODECHEF.extractHandle(profileUrl);
  if (!handle) throw new Error(`Cannot extract CodeChef handle from: ${profileUrl}`);

  logger.info(`Fetching CodeChef stats for: ${handle}`);

  let totalSolved = 0;

  try {
    const url = `https://www.codechef.com/users/${encodeURIComponent(handle)}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    if (response.status >= 400) {
      throw new Error(`CodeChef user not found: ${handle}`);
    }

    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
    totalSolved = parseCodeChefHtml(html);
  } catch (err) {
    if (err.message && err.message.includes('not found')) throw err;
    logger.warn(`CodeChef scrape failed for ${handle}: ${err.message}`);
  }

  logger.info(`CodeChef ${handle}: total=${totalSolved}, sql=0 (no SQL on platform)`);
  return { totalProblemsSolved: totalSolved, sqlProblemsSolved: 0 };
}

module.exports = { fetchCodeChef, parseCodeChefHtml };
