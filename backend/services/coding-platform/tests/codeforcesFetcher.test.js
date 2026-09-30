const nock = require('nock');
const statusFixture = require('./fixtures/codeforces-status.json');

jest.mock('../src/fetchers/browserPool', () => ({
  withPage: jest.fn().mockRejectedValue(new Error('No browser in test')),
}));

const { fetchCodeforces } = require('../src/fetchers/codeforcesFetcher');
const { withPage } = require('../src/fetchers/browserPool');

describe('Codeforces Fetcher', () => {
  afterEach(() => nock.cleanAll());

  it('should deduplicate AC submissions and return total solved', async () => {
    nock('https://codeforces.com')
      .get('/api/user.status')
      .query({ handle: 'testuser', from: '1', count: '10000' })
      .reply(200, statusFixture);

    const result = await fetchCodeforces('https://codeforces.com/profile/testuser');
    // 1900-A (duplicate) and 1900-B are AC, 1899-C is WRONG_ANSWER
    expect(result.totalProblemsSolved).toBe(2);
    expect(result.sqlProblemsSolved).toBe(0);
  });

  it('should use profile count when Puppeteer succeeds', async () => {
    withPage.mockResolvedValueOnce(5);

    const result = await fetchCodeforces('https://codeforces.com/profile/testuser');
    expect(result.totalProblemsSolved).toBe(5);
    expect(result.sqlProblemsSolved).toBe(0);
  });

  it('should throw on invalid URL', async () => {
    await expect(fetchCodeforces('https://example.com/nope')).rejects.toThrow(
      'Cannot extract Codeforces handle'
    );
  });

  it('should throw on API error', async () => {
    nock('https://codeforces.com')
      .get('/api/user.status')
      .query(true)
      .reply(200, { status: 'FAILED', comment: 'handle not found' });

    await expect(
      fetchCodeforces('https://codeforces.com/profile/nonexistent')
    ).rejects.toThrow('Codeforces API error');
  });
});
