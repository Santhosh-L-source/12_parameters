const { calculatePlatformMarks, calculateStudentCPMarks, VALID_PLATFORMS } = require('../src/config/cpRatingThresholds');

describe('CP Rating Thresholds', () => {
  describe('VALID_PLATFORMS', () => {
    it('should have 4 platforms', () => {
      expect(VALID_PLATFORMS).toEqual(['CODEFORCES', 'CODECHEF', 'ATCODER', 'LEETCODE']);
    });
  });

  describe('calculatePlatformMarks', () => {
    // Codeforces: 5@1200, 10@1400, 15@1600, 20@1900
    it('Codeforces: below threshold returns 0', () => {
      expect(calculatePlatformMarks('CODEFORCES', 1100)).toBe(0);
    });
    it('Codeforces: 1200 returns 5', () => {
      expect(calculatePlatformMarks('CODEFORCES', 1200)).toBe(5);
    });
    it('Codeforces: 1400 returns 10', () => {
      expect(calculatePlatformMarks('CODEFORCES', 1400)).toBe(10);
    });
    it('Codeforces: 1600 returns 15', () => {
      expect(calculatePlatformMarks('CODEFORCES', 1600)).toBe(15);
    });
    it('Codeforces: 1900 returns 20', () => {
      expect(calculatePlatformMarks('CODEFORCES', 1900)).toBe(20);
    });
    it('Codeforces: 2500 still returns 20 (max)', () => {
      expect(calculatePlatformMarks('CODEFORCES', 2500)).toBe(20);
    });

    // CodeChef: 5@1400, 10@1600, 15@1800, 20@2000
    it('CodeChef: 1400 returns 5', () => {
      expect(calculatePlatformMarks('CODECHEF', 1400)).toBe(5);
    });
    it('CodeChef: 2000 returns 20', () => {
      expect(calculatePlatformMarks('CODECHEF', 2000)).toBe(20);
    });

    // AtCoder: 5@400, 10@800, 15@1200, 20@1600
    it('AtCoder: 400 returns 5', () => {
      expect(calculatePlatformMarks('ATCODER', 400)).toBe(5);
    });
    it('AtCoder: 1600 returns 20', () => {
      expect(calculatePlatformMarks('ATCODER', 1600)).toBe(20);
    });

    // LeetCode: only milestones 3 & 4 — 15@1850, 20@2150
    it('LeetCode: below 1850 returns 0', () => {
      expect(calculatePlatformMarks('LEETCODE', 1500)).toBe(0);
    });
    it('LeetCode: 1850 returns 15', () => {
      expect(calculatePlatformMarks('LEETCODE', 1850)).toBe(15);
    });
    it('LeetCode: 2150 returns 20', () => {
      expect(calculatePlatformMarks('LEETCODE', 2150)).toBe(20);
    });

    it('unknown platform returns 0', () => {
      expect(calculatePlatformMarks('UNKNOWN', 9999)).toBe(0);
    });

    it('is case-insensitive on platform name', () => {
      expect(calculatePlatformMarks('codeforces', 1400)).toBe(10);
    });
  });

  describe('calculateStudentCPMarks', () => {
    it('picks highest marks across platforms', () => {
      const evidenceList = [
        { platform: 'CODEFORCES', currentRating: 1200 },  // 5
        { platform: 'LEETCODE', currentRating: 1850 },    // 15
      ];
      expect(calculateStudentCPMarks(evidenceList)).toBe(15);
    });

    it('returns 0 for empty list', () => {
      expect(calculateStudentCPMarks([])).toBe(0);
    });

    it('caps at 20', () => {
      const evidenceList = [
        { platform: 'CODEFORCES', currentRating: 2500 },
      ];
      expect(calculateStudentCPMarks(evidenceList)).toBe(20);
    });
  });
});
