'use strict';

const {
  calculateCoreTier,
  calculateOptionalBonus,
  calculateFinalScore,
} = require('../src/services/gateScoringService');

// ─── Base evidence object (all conditions false / zero) ───────────────────────

const BASE = {
  diagnosticCompleted: false,
  testsCompleted: 0,
  fullLengthTestsCompleted: 0,
  averageScorePercent: 0,
  officialAppearance: false,
  qualified: false,
  gateScore: null,
  branchCode: 'CSE',
  optionalExamType: null,
  optionalScorecardValid: false,
  centralThresholdMet: false,
};

const CALIB = { minQualifyingScore: 350, minScoreFor25Marks: 500 };

// Helper: merge BASE with overrides
const ev = (overrides) => ({ ...BASE, ...overrides });

// ─── calculateCoreTier ────────────────────────────────────────────────────────

describe('calculateCoreTier', () => {
  test('returns 0 when no conditions are met', () => {
    const result = calculateCoreTier(BASE, CALIB);
    expect(result).toEqual({ tier: 0, flagMissingCalibration: false });
  });

  describe('Tier 3', () => {
    test('awards 3 for diagnostic completed + 3 tests', () => {
      const result = calculateCoreTier(ev({ diagnosticCompleted: true, testsCompleted: 3 }), CALIB);
      expect(result.tier).toBe(3);
    });

    test('does NOT award 3 if diagnostic missing even with 3 tests', () => {
      const result = calculateCoreTier(ev({ testsCompleted: 3 }), CALIB);
      expect(result.tier).toBe(0);
    });

    test('does NOT award 3 if diagnostic done but fewer than 3 tests', () => {
      const result = calculateCoreTier(ev({ diagnosticCompleted: true, testsCompleted: 2 }), CALIB);
      expect(result.tier).toBe(0);
    });
  });

  describe('Tier 5', () => {
    test('awards 5 for exactly 5 tests (no diagnostic required)', () => {
      const result = calculateCoreTier(ev({ testsCompleted: 5 }), CALIB);
      expect(result.tier).toBe(5);
    });

    test('tier 5 beats tier 3 when both conditions are met', () => {
      const result = calculateCoreTier(
        ev({ diagnosticCompleted: true, testsCompleted: 5 }),
        CALIB
      );
      expect(result.tier).toBe(5);
    });
  });

  describe('Tier 10', () => {
    test('awards 10 for 10 tests with 40% average', () => {
      const result = calculateCoreTier(ev({ testsCompleted: 10, averageScorePercent: 40 }), CALIB);
      expect(result.tier).toBe(10);
    });

    test('does NOT award 10 if average is below 40%', () => {
      const result = calculateCoreTier(ev({ testsCompleted: 10, averageScorePercent: 39.9 }), CALIB);
      expect(result.tier).toBe(5); // falls to tier 5
    });

    test('does NOT award 10 if fewer than 10 tests (even with high avg)', () => {
      const result = calculateCoreTier(ev({ testsCompleted: 9, averageScorePercent: 80 }), CALIB);
      expect(result.tier).toBe(5);
    });

    test('tier 10 beats tier 5 when both conditions are met', () => {
      const result = calculateCoreTier(ev({ testsCompleted: 12, averageScorePercent: 50 }), CALIB);
      expect(result.tier).toBe(10);
    });
  });

  describe('Tier 15 — practice-test path', () => {
    test('awards 15 for 15+ tests, 3+ full-length, 55%+ average', () => {
      const result = calculateCoreTier(
        ev({ testsCompleted: 15, fullLengthTestsCompleted: 3, averageScorePercent: 55 }),
        CALIB
      );
      expect(result.tier).toBe(15);
    });

    test('does NOT award 15 if fullLengthTests < 3', () => {
      const result = calculateCoreTier(
        ev({ testsCompleted: 15, fullLengthTestsCompleted: 2, averageScorePercent: 55 }),
        CALIB
      );
      expect(result.tier).toBe(10); // 15 tests + avg 55% but only 2 full-length → tier 10 (avg>=40)
    });

    test('does NOT award 15 if average < 55%', () => {
      const result = calculateCoreTier(
        ev({ testsCompleted: 15, fullLengthTestsCompleted: 3, averageScorePercent: 54.9 }),
        CALIB
      );
      expect(result.tier).toBe(10);
    });

    test('does NOT award 15 if testsCompleted < 15', () => {
      const result = calculateCoreTier(
        ev({ testsCompleted: 14, fullLengthTestsCompleted: 3, averageScorePercent: 60 }),
        CALIB
      );
      expect(result.tier).toBe(10);
    });
  });

  describe('Tier 15 — official appearance path', () => {
    test('awards 15 for official appearance alone (not qualified)', () => {
      const result = calculateCoreTier(ev({ officialAppearance: true }), CALIB);
      expect(result.tier).toBe(15);
    });

    test('appearance path beats practice-test path (same tier, first branch hit)', () => {
      // Both paths satisfied — tier is 15 regardless
      const result = calculateCoreTier(
        ev({
          officialAppearance: true,
          testsCompleted: 15,
          fullLengthTestsCompleted: 3,
          averageScorePercent: 60,
        }),
        CALIB
      );
      expect(result.tier).toBe(15);
    });
  });

  describe('Tier 20', () => {
    test('awards 20 for appeared + qualified', () => {
      const result = calculateCoreTier(
        ev({ officialAppearance: true, qualified: true }),
        CALIB
      );
      expect(result.tier).toBe(20);
    });

    test('awards 20 when appeared + qualified + gateScore below branch threshold', () => {
      const result = calculateCoreTier(
        ev({ officialAppearance: true, qualified: true, gateScore: 499 }),
        CALIB
      );
      expect(result.tier).toBe(20);
    });

    test('awards 20 when qualified is false even if appeared', () => {
      // qualified=false — this lands on tier-15 (appearance), not tier-20
      const result = calculateCoreTier(ev({ officialAppearance: true, qualified: false }), CALIB);
      expect(result.tier).toBe(15);
    });
  });

  describe('Tier 25', () => {
    test('awards 25 when appeared, qualified, score meets branch threshold', () => {
      const result = calculateCoreTier(
        ev({ officialAppearance: true, qualified: true, gateScore: 500 }),
        CALIB
      );
      expect(result).toEqual({ tier: 25, flagMissingCalibration: false });
    });

    test('awards 25 for score strictly above threshold', () => {
      const result = calculateCoreTier(
        ev({ officialAppearance: true, qualified: true, gateScore: 750 }),
        CALIB
      );
      expect(result.tier).toBe(25);
    });

    test('returns tier 20 + flagMissingCalibration when calibration row is absent', () => {
      const result = calculateCoreTier(
        ev({ officialAppearance: true, qualified: true, gateScore: 600 }),
        null
      );
      expect(result).toEqual({ tier: 20, flagMissingCalibration: true });
    });

    test('does NOT award 25 when gateScore is null (even appeared + qualified)', () => {
      const result = calculateCoreTier(
        ev({ officialAppearance: true, qualified: true, gateScore: null }),
        CALIB
      );
      expect(result.tier).toBe(20);
      expect(result.flagMissingCalibration).toBe(false);
    });
  });

  describe('Highest-tier-wins invariant', () => {
    test('25 wins over all lower tiers simultaneously satisfied', () => {
      const result = calculateCoreTier(
        ev({
          officialAppearance: true,
          qualified: true,
          gateScore: 600,
          testsCompleted: 20,
          fullLengthTestsCompleted: 5,
          averageScorePercent: 70,
          diagnosticCompleted: true,
        }),
        CALIB
      );
      expect(result.tier).toBe(25);
    });
  });

  describe('averageScorePercent stored as Sequelize DECIMAL string', () => {
    test('handles string "55.00" correctly for tier-15 threshold', () => {
      const result = calculateCoreTier(
        ev({ testsCompleted: 15, fullLengthTestsCompleted: 3, averageScorePercent: '55.00' }),
        CALIB
      );
      expect(result.tier).toBe(15);
    });
  });
});

// ─── calculateOptionalBonus ───────────────────────────────────────────────────

describe('calculateOptionalBonus', () => {
  test('returns 0 when coreMark is 0', () => {
    expect(calculateOptionalBonus(ev({ optionalExamType: 'GRE', optionalScorecardValid: true }), 0)).toBe(0);
  });

  test('returns 0 when coreMark is 3 (below gate threshold of 5)', () => {
    expect(calculateOptionalBonus(ev({ optionalExamType: 'CAT', optionalScorecardValid: true }), 3)).toBe(0);
  });

  test('returns 0 when coreMark is exactly 4 (still below 5)', () => {
    expect(calculateOptionalBonus(ev({ optionalExamType: 'GMAT', optionalScorecardValid: true }), 4)).toBe(0);
  });

  describe('GRE / GMAT / CAT → +3', () => {
    test.each(['GRE', 'GMAT', 'CAT'])('%s with valid scorecard yields +3 when coreMark=5', (examType) => {
      expect(
        calculateOptionalBonus(ev({ optionalExamType: examType, optionalScorecardValid: true }), 5)
      ).toBe(3);
    });

    test('returns 0 for GRE when scorecard is not valid', () => {
      expect(
        calculateOptionalBonus(ev({ optionalExamType: 'GRE', optionalScorecardValid: false }), 10)
      ).toBe(0);
    });
  });

  describe('TOEFL / IELTS / PTE → +5', () => {
    test.each(['TOEFL', 'IELTS', 'PTE'])(
      '%s with valid scorecard AND centralThresholdMet yields +5',
      (examType) => {
        expect(
          calculateOptionalBonus(
            ev({ optionalExamType: examType, optionalScorecardValid: true, centralThresholdMet: true }),
            10
          )
        ).toBe(5);
      }
    );

    test.each(['TOEFL', 'IELTS', 'PTE'])(
      '%s with valid scorecard but centralThresholdMet=false yields 0',
      (examType) => {
        expect(
          calculateOptionalBonus(
            ev({ optionalExamType: examType, optionalScorecardValid: true, centralThresholdMet: false }),
            20
          )
        ).toBe(0);
      }
    );

    test('TOEFL with invalid scorecard yields 0 even if centralThresholdMet=true', () => {
      expect(
        calculateOptionalBonus(
          ev({ optionalExamType: 'TOEFL', optionalScorecardValid: false, centralThresholdMet: true }),
          15
        )
      ).toBe(0);
    });
  });

  test('returns 0 when no optional exam submitted', () => {
    expect(calculateOptionalBonus(ev({}), 20)).toBe(0);
  });
});

// ─── calculateFinalScore ──────────────────────────────────────────────────────

describe('calculateFinalScore', () => {
  test('zero evidence yields finalScore=0', () => {
    const result = calculateFinalScore(BASE, CALIB);
    expect(result).toEqual({ coreTier: 0, bonus: 0, finalScore: 0, flagMissingCalibration: false });
  });

  test('coreTier=5, no optional exam → finalScore=5', () => {
    const result = calculateFinalScore(ev({ testsCompleted: 5 }), CALIB);
    expect(result).toEqual({ coreTier: 5, bonus: 0, finalScore: 5, flagMissingCalibration: false });
  });

  test('coreTier=10, GRE valid → finalScore=13', () => {
    const result = calculateFinalScore(
      ev({ testsCompleted: 10, averageScorePercent: 45, optionalExamType: 'GRE', optionalScorecardValid: true }),
      CALIB
    );
    expect(result).toEqual({ coreTier: 10, bonus: 3, finalScore: 13, flagMissingCalibration: false });
  });

  test('coreTier=20, IELTS valid + centralThresholdMet → finalScore capped at 25', () => {
    const result = calculateFinalScore(
      ev({
        officialAppearance: true,
        qualified: true,
        gateScore: 450, // below 500 threshold → tier 20
        optionalExamType: 'IELTS',
        optionalScorecardValid: true,
        centralThresholdMet: true,
      }),
      CALIB
    );
    expect(result).toEqual({ coreTier: 20, bonus: 5, finalScore: 25, flagMissingCalibration: false });
  });

  test('coreTier=25, any bonus still caps at 25', () => {
    const result = calculateFinalScore(
      ev({
        officialAppearance: true,
        qualified: true,
        gateScore: 600,
        optionalExamType: 'PTE',
        optionalScorecardValid: true,
        centralThresholdMet: true,
      }),
      CALIB
    );
    expect(result).toEqual({ coreTier: 25, bonus: 5, finalScore: 25, flagMissingCalibration: false });
  });

  test('coreTier=3, TOEFL valid → bonus ignored, finalScore stays at 3', () => {
    const result = calculateFinalScore(
      ev({
        diagnosticCompleted: true,
        testsCompleted: 3,
        optionalExamType: 'TOEFL',
        optionalScorecardValid: true,
        centralThresholdMet: true,
      }),
      CALIB
    );
    expect(result).toEqual({ coreTier: 3, bonus: 0, finalScore: 3, flagMissingCalibration: false });
  });

  test('missing calibration propagates flag through to final result', () => {
    const result = calculateFinalScore(
      ev({ officialAppearance: true, qualified: true, gateScore: 600 }),
      null
    );
    expect(result.flagMissingCalibration).toBe(true);
    expect(result.coreTier).toBe(20);
    expect(result.finalScore).toBe(20);
  });

  test('L3/Elite eligibility condition: coreTier >= 15 via appearance path', () => {
    // The level-eligibility rule checks coreTier directly, not finalScore
    const result = calculateFinalScore(ev({ officialAppearance: true }), CALIB);
    expect(result.coreTier).toBeGreaterThanOrEqual(15);
  });
});
