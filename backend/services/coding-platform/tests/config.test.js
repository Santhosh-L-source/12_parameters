const config = require('../src/config/config');

describe('Config - URL handle extractors', () => {
  it('LeetCode: extracts handle from /u/ URL', () => {
    expect(config.platforms.LEETCODE.extractHandle('https://leetcode.com/u/john_doe')).toBe(
      'john_doe'
    );
  });

  it('LeetCode: extracts handle from legacy URL', () => {
    expect(config.platforms.LEETCODE.extractHandle('https://leetcode.com/john_doe')).toBe(
      'john_doe'
    );
  });

  it('Codeforces: extracts handle', () => {
    expect(
      config.platforms.CODEFORCES.extractHandle('https://codeforces.com/profile/tourist')
    ).toBe('tourist');
  });

  it('AtCoder: extracts handle', () => {
    expect(config.platforms.ATCODER.extractHandle('https://atcoder.jp/users/tourist')).toBe(
      'tourist'
    );
  });

  it('CodeChef: extracts handle', () => {
    expect(
      config.platforms.CODECHEF.extractHandle('https://www.codechef.com/users/santhosh_l2')
    ).toBe('santhosh_l2');
  });

  it('HackerRank: extracts handle', () => {
    expect(
      config.platforms.HACKERRANK.extractHandle(
        'https://www.hackerrank.com/profile/santhosh_l2'
      )
    ).toBe('santhosh_l2');
  });

  it('GeeksforGeeks: extracts handle from /user/ URL', () => {
    expect(
      config.platforms.GEEKSFORGEEKS.extractHandle(
        'https://www.geeksforgeeks.org/user/aspaborern8p/'
      )
    ).toBe('aspaborern8p');
  });

  it('GeeksforGeeks: extracts handle from /profile/ URL', () => {
    expect(
      config.platforms.GEEKSFORGEEKS.extractHandle(
        'https://www.geeksforgeeks.org/profile/aspaborern8p'
      )
    ).toBe('aspaborern8p');
  });

  it('SkillRack: extracts id and key', () => {
    const result = config.platforms.SKILLRACK.extractId(
      'https://www.skillrack.com/faces/resume.xhtml?id=506067&key=bd342fe346d3e650d87c6a0ed00c175f7e384db9'
    );
    expect(result).toEqual({ id: '506067', key: 'bd342fe346d3e650d87c6a0ed00c175f7e384db9' });
  });

  it('SkillRack: returns null for invalid URL', () => {
    expect(config.platforms.SKILLRACK.extractId('https://www.skillrack.com/other')).toBeNull();
  });
});
