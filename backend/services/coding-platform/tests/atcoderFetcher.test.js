const nock = require('nock');
const { fetchAtCoder } = require('../src/fetchers/atcoderFetcher');
const userInfoFixture = require('./fixtures/atcoder-userinfo.json');

describe('AtCoder Fetcher', () => {
  afterEach(() => nock.cleanAll());

  it('should return accepted_count from kenkoooo API', async () => {
    nock('https://kenkoooo.com')
      .get('/atcoder/atcoder-api/v3/user_info')
      .query({ user: 'tourist' })
      .reply(200, userInfoFixture);

    const result = await fetchAtCoder('https://atcoder.jp/users/tourist');
    expect(result.totalProblemsSolved).toBe(1057);
    expect(result.sqlProblemsSolved).toBe(0);
  });

  it('should throw on invalid URL', async () => {
    await expect(fetchAtCoder('https://example.com/nope')).rejects.toThrow(
      'Cannot extract AtCoder handle'
    );
  });
});
