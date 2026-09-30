const nock = require('nock');
const fs = require('fs');
const path = require('path');
const { fetchSkillRack } = require('../src/fetchers/skillrackFetcher');

const htmlFixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'skillrack-profile.html'),
  'utf-8'
);

describe('SkillRack Fetcher', () => {
  afterEach(() => nock.cleanAll());

  it('should extract PROGRAMS SOLVED and SQL from Semantic UI statistic blocks', async () => {
    nock('https://www.skillrack.com')
      .get('/faces/resume.xhtml')
      .query({ id: '506067', key: 'bd342fe346d3e650d87c6a0ed00c175f7e384db9' })
      .reply(200, htmlFixture);

    const result = await fetchSkillRack(
      'https://www.skillrack.com/faces/resume.xhtml?id=506067&key=bd342fe346d3e650d87c6a0ed00c175f7e384db9'
    );
    expect(result.totalProblemsSolved).toBe(2370);
    expect(result.sqlProblemsSolved).toBe(30);
  });

  it('should throw on invalid URL', async () => {
    await expect(fetchSkillRack('https://www.skillrack.com/other')).rejects.toThrow(
      'Cannot extract SkillRack id/key'
    );
  });

  it('should handle profile with no SQL section', async () => {
    const noSqlHtml = `
      <div class="statistic">
        <div class="value">500</div>
        <div class="label">PROGRAMS SOLVED</div>
      </div>
    `;

    nock('https://www.skillrack.com')
      .get('/faces/resume.xhtml')
      .query({ id: '100', key: 'abc123' })
      .reply(200, noSqlHtml);

    const result = await fetchSkillRack(
      'https://www.skillrack.com/faces/resume.xhtml?id=100&key=abc123'
    );
    expect(result.totalProblemsSolved).toBe(500);
    expect(result.sqlProblemsSolved).toBe(0);
  });
});
