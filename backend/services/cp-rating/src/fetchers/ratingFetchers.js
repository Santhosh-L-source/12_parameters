const axios = require('axios');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function extractHandle(platform, profileUrl) {
  const patterns = {
    CODEFORCES: /codeforces\.com\/profile\/([^/?]+)/,
    CODECHEF: /codechef\.com\/users\/([^/?]+)/,
    ATCODER: /atcoder\.jp\/users\/([^/?]+)/,
    LEETCODE: /leetcode\.com\/u\/([^/?]+)/,
  };
  const fallback = /leetcode\.com\/([^/?]+)/;
  const match = profileUrl.match(patterns[platform]);
  if (match) return match[1];
  if (platform === 'LEETCODE') {
    const m2 = profileUrl.match(fallback);
    return m2 ? m2[1] : null;
  }
  return null;
}

async function fetchCodeforcesRating(profileUrl) {
  const handle = extractHandle('CODEFORCES', profileUrl);
  if (!handle) throw new Error(`Cannot extract Codeforces handle from: ${profileUrl}`);

  const res = await axios.get(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 15000,
  });

  if (res.data.status !== 'OK' || !res.data.result?.length) {
    throw new Error(`Codeforces user not found: ${handle}`);
  }

  const user = res.data.result[0];
  return {
    handle,
    rating: user.rating || 0,
    maxRating: user.maxRating || 0,
    rank: user.rank || 'unrated',
  };
}

async function fetchLeetCodeRating(profileUrl) {
  const handle = extractHandle('LEETCODE', profileUrl);
  if (!handle) throw new Error(`Cannot extract LeetCode handle from: ${profileUrl}`);

  const query = `
    query userContestRankingInfo($username: String!) {
      userContestRanking(username: $username) {
        rating
        globalRanking
        attendedContestsCount
      }
    }
  `;

  const res = await axios.post('https://leetcode.com/graphql', {
    query,
    variables: { username: handle },
  }, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      Referer: `https://leetcode.com/${handle}/`,
    },
    timeout: 15000,
  });

  const ranking = res.data?.data?.userContestRanking;
  return {
    handle,
    rating: ranking ? Math.round(ranking.rating) : 0,
    globalRanking: ranking?.globalRanking || 0,
    contestsAttended: ranking?.attendedContestsCount || 0,
  };
}

async function fetchAtCoderRating(profileUrl) {
  const handle = extractHandle('ATCODER', profileUrl);
  if (!handle) throw new Error(`Cannot extract AtCoder handle from: ${profileUrl}`);

  let rating = 0;
  let highestRating = 0;

  // Strategy 1: Official JSON History endpoint
  try {
    const jsonRes = await axios.get(`https://atcoder.jp/users/${encodeURIComponent(handle)}/history/json`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      timeout: 10000,
    });
    if (Array.isArray(jsonRes.data) && jsonRes.data.length > 0) {
      const last = jsonRes.data[jsonRes.data.length - 1];
      rating = last.NewRating || 0;
      jsonRes.data.forEach(contest => {
        if (contest.NewRating > highestRating) highestRating = contest.NewRating;
      });
      return {
        handle,
        rating,
        highestRating: highestRating || rating,
        contestsAttended: jsonRes.data.length,
      };
    }
  } catch (e) {
    // Fallback to HTML scrape
  }

  // Strategy 2: Profile HTML Scrape
  try {
    const res = await axios.get(`https://atcoder.jp/users/${encodeURIComponent(handle)}`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 15000,
    });

    const html = res.data || '';
    const ratingMatch = html.match(/Rating\s*<\/th>\s*<td[^>]*>[\s\S]*?(\d+)[\s\S]*?<\/td>/i);
    if (ratingMatch) rating = parseInt(ratingMatch[1], 10);

    const highestMatch = html.match(/Highest\s+Rating\s*<\/th>\s*<td[^>]*>[\s\S]*?(\d+)[\s\S]*?<\/td>/i);
    if (highestMatch) highestRating = parseInt(highestMatch[1], 10);
  } catch (err) {}

  return {
    handle,
    rating,
    highestRating: highestRating || rating,
    contestsAttended: 0,
  };
}

async function fetchCodeChefRating(profileUrl) {
  const handle = extractHandle('CODECHEF', profileUrl);
  if (!handle) throw new Error(`Cannot extract CodeChef handle from: ${profileUrl}`);

  const res = await axios.get(`https://www.codechef.com/users/${handle}`, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 15000,
    maxRedirects: 5,
  });

  const html = res.data;
  let rating = 0;
  let highestRating = 0;

  // Extract rating from date_versus_rating JSON data
  const dataMatch = html.match(/"date_versus_rating"\s*:\s*\{[^}]*"all"\s*:\s*\[([\s\S]*?)\]/);
  if (dataMatch) {
    try {
      const contestsJson = '[' + dataMatch[1] + ']';
      const contests = JSON.parse(contestsJson);
      if (contests.length > 0) {
        // Get the latest contest rating
        const latest = contests[contests.length - 1];
        rating = parseInt(latest.rating, 10) || 0;

        // Find highest rating
        contests.forEach(c => {
          const r = parseInt(c.rating, 10) || 0;
          if (r > highestRating) highestRating = r;
        });
      }
    } catch (e) {
      console.error('Failed to parse CodeChef rating JSON:', e.message);
    }
  }

  // Fallback: try other patterns
  if (rating === 0) {
    const ratingMatch = html.match(/var\s+current_rating\s*=\s*(\d+)/);
    if (ratingMatch) rating = parseInt(ratingMatch[1], 10);
  }

  return {
    handle,
    rating,
    highestRating: highestRating || rating,
  };
}

const RATING_FETCHERS = {
  CODEFORCES: fetchCodeforcesRating,
  LEETCODE: fetchLeetCodeRating,
  ATCODER: fetchAtCoderRating,
  CODECHEF: fetchCodeChefRating,
};

const SUPPORTED_PLATFORMS = Object.keys(RATING_FETCHERS);

async function fetchRating(platform, profileUrl) {
  const fetcher = RATING_FETCHERS[platform.toUpperCase()];
  if (!fetcher) return null;
  try {
    return await fetcher(profileUrl);
  } catch (err) {
    console.error(`Failed to fetch ${platform} rating: ${err.message}`);
    return { handle: null, rating: 0, error: err.message };
  }
}

module.exports = { fetchRating, SUPPORTED_PLATFORMS, extractHandle };
