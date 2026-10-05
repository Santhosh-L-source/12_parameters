const axios = require('../utils/axiosAdapter');
const config = require('../config/config');
const logger = require('../utils/logger');

const STATS_QUERY = `
  query userProblemsSolved($username: String!) {
    matchedUser(username: $username) {
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
  }
`;

const TAG_QUERY = `
  query skillStats($username: String!) {
    matchedUser(username: $username) {
      tagProblemCounts {
        advanced {
          tagName
          tagSlug
          problemsSolved
        }
        intermediate {
          tagName
          tagSlug
          problemsSolved
        }
        fundamental {
          tagName
          tagSlug
          problemsSolved
        }
      }
    }
  }
`;

async function fetchLeetCode(profileUrl) {
  const handle = config.platforms.LEETCODE.extractHandle(profileUrl);
  if (!handle) throw new Error(`Cannot extract LeetCode handle from: ${profileUrl}`);

  logger.info(`Fetching LeetCode stats for: ${handle}`);

  const [statsRes, tagRes] = await Promise.all([
    axios.post(
      config.platforms.LEETCODE.graphqlUrl,
      { query: STATS_QUERY, variables: { username: handle } },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
          Referer: `https://leetcode.com/${handle}/`,
        },
      }
    ),
    axios.post(
      config.platforms.LEETCODE.graphqlUrl,
      { query: TAG_QUERY, variables: { username: handle } },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
          Referer: `https://leetcode.com/${handle}/`,
        },
      }
    ),
  ]);

  const user = statsRes.data?.data?.matchedUser;
  if (!user) throw new Error(`LeetCode user not found: ${handle}`);

  const acStats = user.submitStatsGlobal?.acSubmissionNum || [];
  const allEntry = acStats.find((s) => s.difficulty === 'All');
  const totalSolved = allEntry ? allEntry.count : 0;

  const tagUser = tagRes.data?.data?.matchedUser;
  let sqlSolved = 0;
  if (tagUser?.tagProblemCounts) {
    const allTags = [
      ...(tagUser.tagProblemCounts.advanced || []),
      ...(tagUser.tagProblemCounts.intermediate || []),
      ...(tagUser.tagProblemCounts.fundamental || []),
    ];
    const dbTag = allTags.find(
      (t) => t.tagSlug === 'database' || t.tagName?.toLowerCase() === 'database'
    );
    if (dbTag) sqlSolved = dbTag.problemsSolved;
  }

  logger.info(`LeetCode ${handle}: total=${totalSolved}, sql=${sqlSolved}`);
  return { totalProblemsSolved: totalSolved, sqlProblemsSolved: sqlSolved };
}

const PROFILE_QUERY = `
  query userProfileBio($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        aboutMe
        realName
      }
    }
  }
`;

async function verifyLeetCodeOwnership(profileUrl, expectedToken) {
  const handle = config.platforms.LEETCODE.extractHandle(profileUrl);
  if (!handle) return { verified: false, reason: 'Invalid LeetCode URL' };

  try {
    const res = await axios.post(
      config.platforms.LEETCODE.graphqlUrl,
      { query: PROFILE_QUERY, variables: { username: handle } },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
          Referer: `https://leetcode.com/${handle}/`,
        },
      }
    );
    const user = res.data?.data?.matchedUser;
    if (!user) return { verified: false, reason: `LeetCode profile @${handle} not found` };

    const bio = `${user.profile?.aboutMe || ''} ${user.profile?.realName || ''}`;
    const cleanToken = (expectedToken || '').trim().toUpperCase();

    if (cleanToken && bio.toUpperCase().includes(cleanToken)) {
      return { verified: true, handle };
    }
    return {
      verified: false,
      reason: `Verification code "${expectedToken}" was not found in LeetCode profile about/bio for @${handle}. Please save your LeetCode profile bio and try again.`
    };
  } catch (err) {
    logger.error(`LeetCode ownership verify error: ${err.message}`);
    return { verified: false, reason: `Could not verify LeetCode profile bio: ${err.message}` };
  }
}

module.exports = { fetchLeetCode, verifyLeetCodeOwnership };

