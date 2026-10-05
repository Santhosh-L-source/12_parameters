const { fetchLeetCode, verifyLeetCodeOwnership } = require('./leetcodeFetcher');
const { fetchCodeforces } = require('./codeforcesFetcher');
const { fetchAtCoder } = require('./atcoderFetcher');
const { fetchCodeChef } = require('./codechefFetcher');
const { fetchHackerRank } = require('./hackerrankFetcher');
const { fetchGeeksforGeeks } = require('./geeksforgeeksFetcher');
const { fetchSkillRack } = require('./skillrackFetcher');
const { fetchGeneric } = require('./genericFetcher');
const { createBreaker } = require('../resilience/circuitBreaker');
const { withRetry } = require('../resilience/retry');

const fetcherMap = {
  LEETCODE: fetchLeetCode,
  CODEFORCES: fetchCodeforces,
  ATCODER: fetchAtCoder,
  CODECHEF: fetchCodeChef,
  HACKERRANK: fetchHackerRank,
  GEEKSFORGEEKS: fetchGeeksforGeeks,
  SKILLRACK: fetchSkillRack,
};

function getFetcher(platform) {
  const fn = fetcherMap[platform] || fetchGeneric;

  const breaker = createBreaker(platform, async (profileUrl) => {
    return withRetry(() => fn(profileUrl), `${platform}-fetch`);
  });

  return (profileUrl) => breaker.fire(profileUrl);
}

module.exports = { getFetcher, fetcherMap, verifyLeetCodeOwnership };

