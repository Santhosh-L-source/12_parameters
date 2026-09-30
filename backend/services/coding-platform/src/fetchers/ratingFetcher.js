const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Fetch contest rating from LeetCode
 */
async function fetchLeetCodeRating(profileUrlOrHandle) {
  let handle = profileUrlOrHandle;
  if (profileUrlOrHandle.includes('leetcode.com')) {
    handle = config.platforms.LEETCODE.extractHandle(profileUrlOrHandle);
  }
  if (!handle) return 0;

  try {
    const query = `
      query userContestRankingInfo($username: String!) {
        userContestRanking(username: $username) {
          rating
          globalRanking
          totalParticipants
          topPercentage
        }
      }
    `;

    const res = await axios.post(
      config.platforms.LEETCODE.graphqlUrl,
      { query, variables: { username: handle } },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
          Referer: `https://leetcode.com/${handle}/`,
        },
        timeout: 15000,
      }
    );

    const ranking = res.data?.data?.userContestRanking;
    const rating = ranking?.rating ? Math.round(ranking.rating) : 0;
    logger.info(`LeetCode contest rating for ${handle}: ${rating}`);
    return rating;
  } catch (err) {
    logger.warn(`LeetCode contest rating fetch failed for ${handle}: ${err.message}`);
    return 0;
  }
}

/**
 * Fetch rating from Codeforces
 */
async function fetchCodeforcesRating(profileUrlOrHandle) {
  let handle = profileUrlOrHandle;
  if (profileUrlOrHandle.includes('codeforces.com')) {
    handle = config.platforms.CODEFORCES.extractHandle(profileUrlOrHandle);
  }
  if (!handle) return 0;

  try {
    const url = `${config.platforms.CODEFORCES.apiBase}/user.info?handles=${encodeURIComponent(handle)}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 15000,
    });

    if (res.data?.status === 'OK' && res.data.result?.[0]) {
      const user = res.data.result[0];
      const rating = user.rating || user.maxRating || 0;
      logger.info(`Codeforces rating for ${handle}: ${rating}`);
      return rating;
    }
    return 0;
  } catch (err) {
    logger.warn(`Codeforces rating fetch failed for ${handle}: ${err.message}`);
    return 0;
  }
}

const cheerio = require('cheerio');

/**
 * Fetch rating from CodeChef
 */
async function fetchCodeChefRating(profileUrlOrHandle) {
  let handle = profileUrlOrHandle;
  if (profileUrlOrHandle.includes('codechef.com')) {
    handle = config.platforms.CODECHEF.extractHandle(profileUrlOrHandle);
  }
  if (!handle) return 0;

  try {
    const url = `https://www.codechef.com/users/${encodeURIComponent(handle)}`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000,
    });

    const html = res.data || '';
    let rating = 0;

    // Strategy 1: Cheerio .rating-number
    try {
      const $ = cheerio.load(html);
      const rawText = $('.rating-number').text().trim();
      const firstToken = rawText.split(/\s+/)[0];
      if (firstToken && /^\d+$/.test(firstToken)) {
        rating = parseInt(firstToken, 10);
      }
    } catch (e) {}

    // Strategy 2: Drupal settings JSON date_versus_rating
    if (!rating) {
      const drupalMatch = html.match(/jQuery\.extend\(Drupal\.settings,\s*(\{.+?\})\);/s);
      if (drupalMatch) {
        try {
          const settings = JSON.parse(drupalMatch[1]);
          const allRatings = settings.date_versus_rating?.all;
          if (allRatings && allRatings.length > 0) {
            const latest = allRatings[allRatings.length - 1];
            if (latest.rating) rating = parseInt(latest.rating, 10);
          }
        } catch (e) {}
      }
    }

    // Strategy 3: Regex
    if (!rating) {
      const match = html.match(/<div class="rating-number"[^>]*>\s*([0-9]+)/i) ||
                    html.match(/rating-number[^>]*>\s*([0-9]+)/i) ||
                    html.match(/class="rating"[^>]*>\s*([0-9]+)/i);
      if (match) rating = parseInt(match[1], 10);
    }

    logger.info(`CodeChef rating for ${handle}: ${rating}`);
    return rating;
  } catch (err) {
    logger.warn(`CodeChef rating fetch failed for ${handle}: ${err.message}`);
    return 0;
  }
}

/**
 * Fetch rating from AtCoder
 */
async function fetchAtCoderRating(profileUrlOrHandle) {
  let handle = profileUrlOrHandle;
  if (profileUrlOrHandle.includes('atcoder.jp')) {
    handle = config.platforms.ATCODER.extractHandle(profileUrlOrHandle);
  }
  if (!handle) return 0;

  try {
    const url = `https://atcoder.jp/users/${encodeURIComponent(handle)}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 15000,
    });

    const html = res.data || '';
    let rating = 0;

    // Strategy 1: Cheerio table row
    try {
      const $ = cheerio.load(html);
      $('th').each((i, el) => {
        if ($(el).text().trim() === 'Rating') {
          const valText = $(el).next('td').text().trim();
          const m = valText.match(/(\d+)/);
          if (m) rating = parseInt(m[1], 10);
        }
      });
    } catch (e) {}

    // Strategy 2: Regex
    if (!rating) {
      const match = html.match(/Rating\s*<\/th>\s*<td[^>]*>\s*<span[^>]*>\s*(\d+)/i) ||
                    html.match(/Rating\s*<\/th>\s*<td[^>]*>\s*(\d+)/i);
      if (match) rating = parseInt(match[1], 10);
    }

    logger.info(`AtCoder rating for ${handle}: ${rating}`);
    return rating;
  } catch (err) {
    logger.warn(`AtCoder rating fetch failed for ${handle}: ${err.message}`);
    return 0;
  }
}

/**
 * Generic rating fetcher mapping
 */
async function fetchRatingForPlatform(platform, profileUrl, username) {
  const plat = (platform || '').trim().toUpperCase();
  const target = profileUrl || username;
  if (!target) return 0;

  if (plat === 'LEETCODE' || plat === 'LEETCODE_CONTEST') {
    return await fetchLeetCodeRating(target);
  } else if (plat === 'CODEFORCES') {
    return await fetchCodeforcesRating(target);
  } else if (plat === 'CODECHEF') {
    return await fetchCodeChefRating(target);
  } else if (plat === 'ATCODER') {
    return await fetchAtCoderRating(target);
  }
  return 0;
}

module.exports = {
  fetchLeetCodeRating,
  fetchCodeforcesRating,
  fetchCodeChefRating,
  fetchAtCoderRating,
  fetchRatingForPlatform,
};
