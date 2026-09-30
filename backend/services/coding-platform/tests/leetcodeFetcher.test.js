const nock = require('nock');
const { fetchLeetCode } = require('../src/fetchers/leetcodeFetcher');
const statsFixture = require('./fixtures/leetcode-stats.json');
const tagsFixture = require('./fixtures/leetcode-tags.json');

describe('LeetCode Fetcher', () => {
  afterEach(() => nock.cleanAll());

  it('should extract total and SQL solved from GraphQL response', async () => {
    nock('https://leetcode.com')
      .post('/graphql', (body) => body.query.includes('userProblemsSolved'))
      .reply(200, statsFixture);

    nock('https://leetcode.com')
      .post('/graphql', (body) => body.query.includes('skillStats'))
      .reply(200, tagsFixture);

    const result = await fetchLeetCode('https://leetcode.com/u/testuser');
    expect(result.totalProblemsSolved).toBe(350);
    expect(result.sqlProblemsSolved).toBe(25);
  });

  it('should throw on invalid profile URL', async () => {
    await expect(fetchLeetCode('https://example.com/nope')).rejects.toThrow(
      'Cannot extract LeetCode handle'
    );
  });

  it('should throw when user not found', async () => {
    nock('https://leetcode.com')
      .post('/graphql')
      .reply(200, { data: { matchedUser: null } });

    nock('https://leetcode.com').post('/graphql').reply(200, { data: { matchedUser: null } });

    await expect(fetchLeetCode('https://leetcode.com/u/nobody123xyz')).rejects.toThrow(
      'LeetCode user not found'
    );
  });

  it('should handle URL with /u/ prefix', async () => {
    nock('https://leetcode.com').post('/graphql').twice().reply(200, statsFixture);

    // The tag query also fires — mock it
    nock('https://leetcode.com').post('/graphql').reply(200, tagsFixture);

    const result = await fetchLeetCode('https://leetcode.com/u/john_doe');
    expect(result.totalProblemsSolved).toBeGreaterThanOrEqual(0);
  });
});
