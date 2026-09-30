const axios = require('axios');
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

module.exports = { fetchLeetCode };
