const axios = require('axios');
const { withPage } = require('./browserPool');
const logger = require('../utils/logger');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Known platform handlers keyed by domain pattern
const KNOWN_HANDLERS = [
  { match: /neetcode\.io/, handler: fetchNeetCode },
  { match: /hackerearth\.com/, handler: fetchHackerEarth },
  { match: /spoj\.com/, handler: fetchSPOJ },
  { match: /interviewbit\.com/, handler: fetchInterviewBit },
  { match: /codingninjas\.com|naukri\.com\/code360/, handler: fetchCodingNinjas },
  { match: /exercism\.org/, handler: fetchExercism },
  { match: /projecteuler\.net/, handler: fetchProjectEuler },
  { match: /codewars\.com/, handler: fetchCodewars },
  { match: /topcoder\.com/, handler: fetchTopCoder },
  { match: /beecrowd\.com|uri\.judge/, handler: fetchBeecrowd },
];

// ---- NeetCode ----
async function fetchNeetCode(profileUrl) {
  const handle = profileUrl.match(/neetcode\.io\/(?:user|profile)\/([^/?#]+)/)?.[1];
  if (!handle) return null;

  try {
    const res = await axios.get(`https://neetcode.io/api/user/${handle}`, {
      headers: { 'User-Agent': UA },
      timeout: 15000,
    }).catch(() => null);

    if (res?.data) {
      const data = res.data;
      const solved = data.solvedProblems || data.solved || data.totalSolved || 0;
      if (solved > 0) return { totalProblemsSolved: solved, sqlProblemsSolved: 0 };
    }
  } catch (_) {}

  return scrapeWithPuppeteer(profileUrl, {
    waitFor: '[class*="solved"], [class*="problem"], [class*="progress"], .text-green',
    extraEval: `
      // NeetCode shows solved/total like "150 / 150"
      let total = 0;
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent.trim();
        const m = text.match(/^(\\d+)\\s*\\/\\s*\\d+$/);
        if (m) {
          const val = parseInt(m[1], 10);
          if (val > total && val < 5000) total = val;
        }
      });
      // Also check for "X solved" or "X problems"
      const bodyText = document.body.innerText;
      const solvedMatch = bodyText.match(/(\\d+)\\s*(?:solved|completed|finished)/i);
      if (solvedMatch) {
        const val = parseInt(solvedMatch[1], 10);
        if (val > total && val < 10000) total = val;
      }
      if (total > 0) return { totalProblemsSolved: total, sqlProblemsSolved: 0 };
    `,
  });
}

// ---- HackerEarth ----
async function fetchHackerEarth(profileUrl) {
  const handle = profileUrl.match(/hackerearth\.com\/@?([^/?#]+)/)?.[1];
  if (!handle) return null;

  try {
    const res = await axios.get(`https://www.hackerearth.com/AJAX/hacker/profile-details/${handle}/`, {
      headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' },
      timeout: 15000,
    }).catch(() => null);

    if (res?.data) {
      const solved = res.data.problems_solved || res.data.total_problems_solved || 0;
      if (solved > 0) return { totalProblemsSolved: solved, sqlProblemsSolved: 0 };
    }
  } catch (_) {}

  return scrapeWithPuppeteer(profileUrl, {
    waitFor: '.problems-solved, .track-stats, [class*="problem"]',
  });
}

// ---- SPOJ ----
async function fetchSPOJ(profileUrl) {
  const handle = profileUrl.match(/spoj\.com\/users\/([^/?#]+)/)?.[1];
  if (!handle) return null;

  try {
    const res = await axios.get(`https://www.spoj.com/users/${handle}/`, {
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });

    if (res?.data) {
      const html = res.data;
      const solvedSection = html.match(/Problems solved:\s*(\d+)/i);
      if (solvedSection) {
        return { totalProblemsSolved: parseInt(solvedSection[1], 10), sqlProblemsSolved: 0 };
      }
      const dtMatch = html.match(/<dt>\s*Solutions\s*<\/dt>\s*<dd>\s*(\d+)/i);
      if (dtMatch) {
        return { totalProblemsSolved: parseInt(dtMatch[1], 10), sqlProblemsSolved: 0 };
      }
    }
  } catch (_) {}

  return scrapeWithPuppeteer(profileUrl, {
    waitFor: '#user-profile-left, .profile-info-data',
  });
}

// ---- InterviewBit ----
async function fetchInterviewBit(profileUrl) {
  const handle = profileUrl.match(/interviewbit\.com\/profile\/([^/?#]+)/)?.[1];
  if (!handle) return null;

  return scrapeWithPuppeteer(profileUrl, {
    waitFor: '.profile-stats, [class*="solved"], [class*="problem"]',
    extraEval: `
      let total = 0;
      document.querySelectorAll('.stat-value, .solved-count, [class*="solved"]').forEach(el => {
        const val = parseInt(el.textContent.replace(/,/g, ''), 10);
        if (val > total && val < 50000) total = val;
      });
      if (total > 0) return { totalProblemsSolved: total, sqlProblemsSolved: 0 };
    `,
  });
}

// ---- Coding Ninjas / Code360 ----
async function fetchCodingNinjas(profileUrl) {
  const handle = profileUrl.match(/(?:codingninjas\.com|naukri\.com\/code360)\/profile\/([^/?#]+)/)?.[1];
  if (!handle) return null;

  try {
    const res = await axios.get(`https://api.codingninjas.com/api/v3/public_section/profile/user_profile_detail/${handle}`, {
      headers: { 'User-Agent': UA },
      timeout: 15000,
    }).catch(() => null);

    if (res?.data?.data) {
      const d = res.data.data;
      const solved = d.total_problems_solved || d.problemsSolved || 0;
      if (solved > 0) return { totalProblemsSolved: solved, sqlProblemsSolved: 0 };
    }
  } catch (_) {}

  return scrapeWithPuppeteer(profileUrl, {
    waitFor: '[class*="solved"], [class*="problem"], .profile-details',
  });
}

// ---- Exercism ----
async function fetchExercism(profileUrl) {
  const handle = profileUrl.match(/exercism\.org\/profiles\/([^/?#]+)/)?.[1];
  if (!handle) return null;

  try {
    const res = await axios.get(`https://exercism.org/api/v2/profiles/${handle}`, {
      headers: { 'User-Agent': UA },
      timeout: 15000,
    }).catch(() => null);

    if (res?.data?.profile) {
      const solved = res.data.profile.solutions_count || res.data.profile.exercises_completed || 0;
      if (solved > 0) return { totalProblemsSolved: solved, sqlProblemsSolved: 0 };
    }
  } catch (_) {}

  return scrapeWithPuppeteer(profileUrl, {
    waitFor: '.completed-exercises, [class*="solution"]',
  });
}

// ---- Project Euler ----
async function fetchProjectEuler(profileUrl) {
  return scrapeWithPuppeteer(profileUrl, {
    waitFor: '#problems_solved, .info, #score_history',
    extraEval: `
      const solvedEl = document.querySelector('#problems_solved');
      if (solvedEl) {
        const m = solvedEl.textContent.match(/(\\d+)/);
        if (m) return { totalProblemsSolved: parseInt(m[1], 10), sqlProblemsSolved: 0 };
      }
    `,
  });
}

// ---- Codewars ----
async function fetchCodewars(profileUrl) {
  const handle = profileUrl.match(/codewars\.com\/users\/([^/?#]+)/)?.[1];
  if (!handle) return null;

  try {
    const res = await axios.get(`https://www.codewars.com/api/v1/users/${handle}`, {
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });

    if (res?.data) {
      const solved = res.data.codeChallenges?.totalCompleted || 0;
      return { totalProblemsSolved: solved, sqlProblemsSolved: 0 };
    }
  } catch (_) {}

  return null;
}

// ---- TopCoder ----
async function fetchTopCoder(profileUrl) {
  const handle = profileUrl.match(/topcoder\.com\/(?:members|profile)\/([^/?#]+)/)?.[1];
  if (!handle) return null;

  try {
    const res = await axios.get(`https://api.topcoder.com/v5/members/${handle}/stats`, {
      headers: { 'User-Agent': UA },
      timeout: 15000,
    }).catch(() => null);

    if (res?.data) {
      let total = 0;
      const stats = Array.isArray(res.data) ? res.data : [res.data];
      for (const s of stats) {
        if (s.challenges) total += s.challenges;
        if (s.wins) total += s.wins;
      }
      if (total > 0) return { totalProblemsSolved: total, sqlProblemsSolved: 0 };
    }
  } catch (_) {}

  return scrapeWithPuppeteer(profileUrl, {
    waitFor: '.challenge-stats, [class*="stat"]',
  });
}

// ---- Beecrowd (formerly URI Online Judge) ----
async function fetchBeecrowd(profileUrl) {
  return scrapeWithPuppeteer(profileUrl, {
    waitFor: '.profile-stats, [class*="solved"], .pb-solved',
    extraEval: `
      let total = 0;
      // Beecrowd shows "X Problems Solved"
      const text = document.body.innerText;
      const m = text.match(/(\\d+)\\s*Problems?\\s*Solved/i);
      if (m) total = parseInt(m[1], 10);
      if (total > 0) return { totalProblemsSolved: total, sqlProblemsSolved: 0 };
    `,
  });
}

// ---- Puppeteer-based smart scraper (shared helper) ----
async function scrapeWithPuppeteer(profileUrl, opts = {}) {
  try {
    return await withPage(async (page) => {
      await page.setUserAgent(UA);
      await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      if (opts.waitFor) {
        await page.waitForSelector(opts.waitFor, { timeout: 8000 }).catch(() => {});
      }

      // Extra wait for JS-heavy pages
      await new Promise(r => setTimeout(r, 2000));

      const stats = await page.evaluate((extraEval) => {
        // Run platform-specific eval first
        if (extraEval) {
          try {
            const fn = new Function(extraEval);
            const result = fn();
            if (result && result.totalProblemsSolved > 0) return result;
          } catch (_) {}
        }

        const body = document.body.innerText || '';

        // ---- Total solved detection ----
        let totalSolved = 0;

        // Pattern 1: "X / Y" format (common on many sites: "150 / 300 solved")
        const slashPatterns = body.matchAll(/(\d[\d,]*)\s*\/\s*\d[\d,]*/g);
        for (const m of slashPatterns) {
          const val = parseInt(m[1].replace(/,/g, ''), 10);
          if (val > totalSolved && val < 50000) totalSolved = val;
        }

        // Pattern 2: Explicit "solved" / "completed" phrases
        const phrasePatterns = [
          /(\d[\d,]*)\s*(?:problems?\s*solved|solved\s*problems?)/gi,
          /(?:problems?\s*solved|solved\s*problems?)\s*[:\-–]?\s*(\d[\d,]*)/gi,
          /(\d[\d,]*)\s*(?:challenges?\s*(?:solved|completed|done))/gi,
          /(?:challenges?\s*(?:solved|completed))\s*[:\-–]?\s*(\d[\d,]*)/gi,
          /(\d[\d,]*)\s*(?:questions?\s*solved)/gi,
          /(?:total\s*solved|total\s*score|total\s*problems)\s*[:\-–]?\s*(\d[\d,]*)/gi,
          /(?:solved|accepted|completed)\s*[:\-–]?\s*(\d[\d,]*)/gi,
          /(\d[\d,]*)\s*(?:solved|accepted|completed)/gi,
          /(\d[\d,]*)\s*(?:exercises?\s*completed)/gi,
          /(\d[\d,]*)\s*submissions?\s*accepted/gi,
        ];

        for (const pat of phrasePatterns) {
          let m;
          while ((m = pat.exec(body)) !== null) {
            const val = parseInt((m[1] || m[2] || '0').replace(/,/g, ''), 10);
            if (val > 0 && val < 50000 && val > totalSolved) totalSolved = val;
          }
        }

        // Pattern 3: DOM elements with relevant class/id names
        const selectors = [
          '[class*="solved"]', '[class*="problem"]', '[class*="challenge"]',
          '[class*="accepted"]', '[class*="score"]', '[class*="submission"]',
          '[class*="complete"]', '[class*="progress"]', '[class*="stat"]',
          '[id*="solved"]', '[id*="problem"]', '[id*="score"]',
          '[data-solved]', '[data-problems]', '[data-score]',
        ];

        for (const sel of selectors) {
          try {
            document.querySelectorAll(sel).forEach(el => {
              const text = el.textContent.trim();
              // Match standalone numbers or "number / number"
              const nums = text.match(/\b(\d[\d,]*)\b/g);
              if (nums) {
                for (const n of nums) {
                  const val = parseInt(n.replace(/,/g, ''), 10);
                  if (val > 0 && val < 50000 && val > totalSolved) totalSolved = val;
                }
              }
            });
          } catch (_) {}
        }

        // ---- SQL detection ----
        let sqlSolved = 0;
        const sqlPatterns = [
          /sql\s*[:\-–]?\s*(\d[\d,]*)/gi,
          /(\d[\d,]*)\s*sql/gi,
          /sql\s*(?:problems?|challenges?|questions?)\s*[:\-–]?\s*(\d[\d,]*)/gi,
        ];

        for (const pat of sqlPatterns) {
          let m;
          while ((m = pat.exec(body)) !== null) {
            const val = parseInt((m[1] || m[2] || '0').replace(/,/g, ''), 10);
            if (val > 0 && val < 50000 && val > sqlSolved) sqlSolved = val;
          }
        }

        return { totalProblemsSolved: totalSolved, sqlProblemsSolved: sqlSolved };
      }, opts.extraEval || null);

      return stats;
    });
  } catch (err) {
    logger.warn(`Puppeteer scrape failed for ${profileUrl}: ${err.message}`);
    return null;
  }
}

// ---- Main entry point ----
async function fetchGeneric(profileUrl) {
  logger.info(`Generic fetcher: processing ${profileUrl}`);

  // Try known platform handlers first
  for (const { match, handler } of KNOWN_HANDLERS) {
    if (match.test(profileUrl)) {
      logger.info(`Generic fetcher: detected known platform for ${profileUrl}`);
      try {
        const result = await handler(profileUrl);
        if (result && result.totalProblemsSolved > 0) {
          logger.info(`Generic fetcher result: total=${result.totalProblemsSolved}, sql=${result.sqlProblemsSolved}`);
          return result;
        }
      } catch (err) {
        logger.warn(`Known handler failed for ${profileUrl}: ${err.message}`);
      }
      break;
    }
  }

  // Fallback: generic smart scraper
  logger.info(`Generic fetcher: using smart scraper for ${profileUrl}`);
  const result = await scrapeWithPuppeteer(profileUrl);

  if (result && result.totalProblemsSolved > 0) {
    logger.info(`Generic fetcher scraped: total=${result.totalProblemsSolved}, sql=${result.sqlProblemsSolved}`);
    return result;
  }

  logger.info(`Generic fetcher: could not detect counts for ${profileUrl}, returning 0`);
  return { totalProblemsSolved: 0, sqlProblemsSolved: 0 };
}

module.exports = { fetchGeneric };
