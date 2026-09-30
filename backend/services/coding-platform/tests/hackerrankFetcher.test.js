const nock = require('nock');
const { fetchHackerRank } = require('../src/fetchers/hackerrankFetcher');
const scoresFixture = require('./fixtures/hackerrank-scores.json');

// Mock Puppeteer — browser pool won't be available in CI
jest.mock('../src/fetchers/browserPool', () => ({
  withPage: jest.fn(),
  getBrowser: jest.fn(),
  closeBrowser: jest.fn(),
}));

describe('HackerRank Fetcher', () => {
  afterEach(() => nock.cleanAll());

  it('should extract SQL and total scores from scores_elo API', async () => {
    nock('https://www.hackerrank.com')
      .get('/rest/hackers/testuser/scores_elo')
      .reply(200, scoresFixture);

    const result = await fetchHackerRank('https://www.hackerrank.com/profile/testuser');
    // 45 (SQL) + 120 (Algorithms) + 80 (Data Structures) = 245
    expect(result.totalProblemsSolved).toBe(245);
    expect(result.sqlProblemsSolved).toBe(45);
  });

  it('should throw when API returns 404 (profiles removed)', async () => {
    nock('https://www.hackerrank.com')
      .get('/rest/hackers/testuser/scores_elo')
      .reply(404, { error: 'Not Found' });

    await expect(
      fetchHackerRank('https://www.hackerrank.com/profile/testuser')
    ).rejects.toThrow('no longer accessible');
  });

  it('should throw on invalid URL', async () => {
    await expect(fetchHackerRank('https://example.com/nope')).rejects.toThrow(
      'Cannot extract HackerRank handle'
    );
  });
});
