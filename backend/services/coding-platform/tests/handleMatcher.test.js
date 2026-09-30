const { checkHandleMismatch, similarity, normalizeName } = require('../src/utils/handleMatcher');

describe('normalizeName', () => {
  test('strips numbers, underscores, and lowercases', () => {
    expect(normalizeName('Santhosh_L20')).toBe('santhoshl');
    expect(normalizeName('Ritish_S')).toBe('ritishs');
    expect(normalizeName('santhoshl61yt')).toBe('santhoshlyt');
  });

  test('returns empty for falsy input', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName('')).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('similarity', () => {
  test('identical handles return 1', () => {
    expect(similarity('santhosh', 'santhosh')).toBe(1);
  });

  test('same person different handles score high', () => {
    expect(similarity('Santhosh_L20', 'Santhosh20_L')).toBeGreaterThanOrEqual(0.8);
    expect(similarity('Santhosh_L20', 'santhoshl61yt')).toBeGreaterThanOrEqual(0.8);
  });

  test('different people score low', () => {
    expect(similarity('Ritish_S', 'Santhosh_L20')).toBeLessThan(0.5);
    expect(similarity('Ritish_S', 'santhoshl61yt')).toBeLessThan(0.5);
  });

  test('null or empty returns 0', () => {
    expect(similarity(null, 'abc')).toBe(0);
    expect(similarity('abc', '')).toBe(0);
  });
});

describe('checkHandleMismatch', () => {
  const existing = [
    { platform: 'CODEFORCES', profileUrl: 'https://codeforces.com/profile/Santhosh_L20' },
    { platform: 'LEETCODE', profileUrl: 'https://leetcode.com/u/Santhosh20_L' },
  ];

  test('warns on clearly different handle', () => {
    const result = checkHandleMismatch('ATCODER', 'https://atcoder.jp/users/Ritish_S', existing);
    expect(result).not.toBeNull();
    expect(result.warning).toContain('Ritish_S');
  });

  test('no warning on matching handle', () => {
    const result = checkHandleMismatch('ATCODER', 'https://atcoder.jp/users/Santhosh_L20', existing);
    expect(result).toBeNull();
  });

  test('no warning when no existing records', () => {
    const result = checkHandleMismatch('LEETCODE', 'https://leetcode.com/u/anything', []);
    expect(result).toBeNull();
  });

  test('skips comparison against same platform', () => {
    const result = checkHandleMismatch('CODEFORCES', 'https://codeforces.com/profile/TotallyDifferent', [
      { platform: 'CODEFORCES', profileUrl: 'https://codeforces.com/profile/Santhosh_L20' },
    ]);
    expect(result).toBeNull();
  });
});
