const { calculateCPRatingMarks, calculateStudentCPMarks, VALID_PLATFORMS } = require('../src/config/cpRatingThresholds');

describe('CP Rating Thresholds', () => {
  describe('VALID_PLATFORMS', () => {
    it('should have 4 platforms', () => {
      expect(VALID_PLATFORMS).toEqual(['CODEFORCES', 'CODECHEF', 'ATCODER', 'LEETCODE']);
    });
  });

  describe('calculateCPRatingMarks', () => {
    // Codeforces: 5@1200, 10@1400, 15@1600, 20@1900
    it('Codeforces: below threshold returns 0', () => {
      expect(calculateCPRatingMarks('CODEFORCES', 1100)).toBe(0);
    });
    it('Codeforces: 1200 returns 5', () => {
      expect(calculateCPRatingMarks('CODEFORCES', 1200)).toBe(5);
    });
    it('Codeforces: 1400 returns 10', () => {
      expect(calculateCPRatingMarks('CODEFORCES', 1400)).toBe(10);
    });
    it('Codeforces: 1600 returns 15', () => {
      expect(calculateCPRatingMarks('CODEFORCES', 1600)).toBe(15);
    });
    it('Codeforces: 1900 returns 20', () => {
      expect(calculateCPRatingMarks('CODEFORCES', 1900)).toBe(20);
    });
    it('Codeforces: 2500 still returns 20 (max)', () => {
      expect(calculateCPRatingMarks('CODEFORCES', 2500)).toBe(20);
    });

    // CodeChef: 5@1400, 10@1600, 15@1800, 20@2000
    it('CodeChef: 1400 returns 5', () => {
      expect(calculateCPRatingMarks('CODECHEF', 1400)).toBe(5);
    });
    it('CodeChef: 2000 returns 20', () => {
      expect(calculateCPRatingMarks('CODECHEF', 2000)).toBe(20);
    });

    // AtCoder: 5@800, 10@1200, 15@1600, 20@2000
    it('AtCoder: 800 returns 5', () => {
      expect(calculateCPRatingMarks('ATCODER', 800)).toBe(5);
    });
    it('AtCoder: 2000 returns 20', () => {
      expect(calculateCPRatingMarks('ATCODER', 2000)).toBe(20);
    });

    // LeetCode: 5@1500, 10@1700, 15@1900, 20@2100
    it('LeetCode: 1500 returns 5', () => {
      expect(calculateCPRatingMarks('LEETCODE', 1500)).toBe(5);
    });
    it('LeetCode: 2100 returns 20', () => {
      expect(calculateCPRatingMarks('LEETCODE', 2100)).toBe(20);
    });

    it('unknown platform returns 0', () => {
      expect(calculateCPRatingMarks('UNKNOWN', 9999)).toBe(0);
    });

    it('is case-insensitive on platform name', () => {
      expect(calculateCPRatingMarks('codeforces', 1400)).toBe(10);
    });
  });

  describe('calculateStudentCPMarks', () => {
    it('picks highest marks across platforms', () => {
      const evidenceList = [
        { platform: 'CODEFORCES', currentRating: 1200 },  // 5
        { platform: 'LEETCODE', currentRating: 1900 },    // 15
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
