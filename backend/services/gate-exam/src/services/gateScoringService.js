'use strict';

// No DB calls inside these functions — callers fetch data first and pass it in.

const LANGUAGE_EXAMS = new Set(['TOEFL', 'IELTS', 'PTE']);
const APTITUDE_EXAMS = new Set(['GRE', 'GMAT', 'CAT']);

/**
 * Determine the single highest core tier earned.
 *
 * @param {object} evidence  - plain object with gate_evidence fields
 * @param {object|null} branchCalibration - active gate_branch_calibration row for the branch,
 *   or null if none exists. Only minScoreFor25Marks is required from it.
 *
 * @returns {{ tier: number, flagMissingCalibration: boolean }}
 *   tier — 0 | 3 | 5 | 10 | 15 | 20 | 25
 *   flagMissingCalibration — true when the student meets appeared+qualified+score conditions
 *   for tier-25 but no calibration row exists; admin must add one before the final score
 *   can be resolved to 25. The tier returned is 20 in this case (next best confirmed tier).
 */
function calculateCoreTier(evidence, branchCalibration) {
  const {
    officialAppearance,
    qualified,
    gateScore,
    testsCompleted,
    fullLengthTestsCompleted,
    averageScorePercent,
    diagnosticCompleted,
  } = evidence;

  // --- Tier 25 ---
  if (officialAppearance && qualified && gateScore != null) {
    if (branchCalibration == null) {
      // Cannot evaluate tier-25 without calibration data; flag for admin resolution.
      // Award tier-20 (the next confirmed tier) rather than silently giving 0.
      return { tier: 20, flagMissingCalibration: true };
    }
    if (gateScore >= branchCalibration.minScoreFor25Marks) {
      return { tier: 25, flagMissingCalibration: false };
    }
    // Score present but below threshold — fall through to tier-20
  }

  // --- Tier 20 ---
  if (officialAppearance && qualified) {
    return { tier: 20, flagMissingCalibration: false };
  }

  // --- Tier 15 (two alternate paths — same value, not additive) ---
  const tier15ByTests =
    testsCompleted >= 15 &&
    fullLengthTestsCompleted >= 3 &&
    Number(averageScorePercent) >= 55;

  if (officialAppearance || tier15ByTests) {
    return { tier: 15, flagMissingCalibration: false };
  }

  // --- Tier 10 ---
  if (testsCompleted >= 10 && Number(averageScorePercent) >= 40) {
    return { tier: 10, flagMissingCalibration: false };
  }

  // --- Tier 5 ---
  if (testsCompleted >= 5) {
    return { tier: 5, flagMissingCalibration: false };
  }

  // --- Tier 3 ---
  if (diagnosticCompleted && testsCompleted >= 3) {
    return { tier: 3, flagMissingCalibration: false };
  }

  return { tier: 0, flagMissingCalibration: false };
}

/**
 * Compute optional-exam bonus. Bonus is zero if coreMark < 5 regardless of scorecard.
 *
 * GRE / GMAT / CAT — valid scorecard                            → +3
 * TOEFL / IELTS / PTE — valid scorecard AND centralThresholdMet → +5
 *
 * @param {object} evidence  - plain object with optionalExamType, optionalScorecardValid,
 *   centralThresholdMet fields
 * @param {number} coreMark  - result of calculateCoreTier().tier
 * @returns {number} bonus — 0 | 3 | 5
 */
function calculateOptionalBonus(evidence, coreMark) {
  if (coreMark < 5) return 0;

  const { optionalExamType, optionalScorecardValid, centralThresholdMet } = evidence;

  if (!optionalExamType || !optionalScorecardValid) return 0;

  if (LANGUAGE_EXAMS.has(optionalExamType) && centralThresholdMet) return 5;
  if (APTITUDE_EXAMS.has(optionalExamType)) return 3;

  return 0;
}

/**
 * Full score calculation: core tier + optional bonus, hard-capped at 25.
 *
 * @param {object} evidence          - gate_evidence fields
 * @param {object|null} branchCalibration - active calibration row or null
 * @returns {{ coreTier: number, bonus: number, finalScore: number, flagMissingCalibration: boolean }}
 */
function calculateFinalScore(evidence, branchCalibration) {
  const { tier: coreTier, flagMissingCalibration } = calculateCoreTier(
    evidence,
    branchCalibration
  );
  const bonus = calculateOptionalBonus(evidence, coreTier);
  const finalScore = Math.min(coreTier + bonus, 25);

  return { coreTier, bonus, finalScore, flagMissingCalibration };
}

module.exports = { calculateCoreTier, calculateOptionalBonus, calculateFinalScore };
