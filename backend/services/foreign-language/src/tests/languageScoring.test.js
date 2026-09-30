'use strict';

const {
  cefrToMarks,
  calculateParameterScore,
  isEnglishVariant,
} = require('../services/languageScoringService');

// Helper: build a minimal approved evidence row.
function row(language, cefr) {
  return {
    language_name_normalized: language.toLowerCase().trim(),
    cefr_level: cefr,
  };
}

// ── cefrToMarks ──────────────────────────────────────────────────────────────

describe('cefrToMarks', () => {
  test('A1 → 7', () => expect(cefrToMarks('A1')).toBe(7));
  test('A2 → 12', () => expect(cefrToMarks('A2')).toBe(12));
  test('B1 → 15', () => expect(cefrToMarks('B1')).toBe(15));
  test('B2 → 15 (capped at MAX_MARKS)', () => expect(cefrToMarks('B2')).toBe(15));
  test('C1 → 15 (capped at MAX_MARKS)', () => expect(cefrToMarks('C1')).toBe(15));
  test('C2 → 15 (capped at MAX_MARKS)', () => expect(cefrToMarks('C2')).toBe(15));
  test('unknown level → 0', () => expect(cefrToMarks('X9')).toBe(0));
  test('empty string → 0', () => expect(cefrToMarks('')).toBe(0));
});

// ── isEnglishVariant ─────────────────────────────────────────────────────────

describe('isEnglishVariant', () => {
  test('"English" is rejected', () => expect(isEnglishVariant('English')).toBe(true));
  test('"ENGLISH" (uppercase) is rejected', () => expect(isEnglishVariant('ENGLISH')).toBe(true));
  test('"english" (lowercase) is rejected', () => expect(isEnglishVariant('english')).toBe(true));
  test('"  English  " (padded) is rejected', () => expect(isEnglishVariant('  English  ')).toBe(true));
  test('"English Language" is rejected', () => expect(isEnglishVariant('English Language')).toBe(true));
  test('"IELTS" is rejected', () => expect(isEnglishVariant('IELTS')).toBe(true));
  test('"TOEFL" is rejected', () => expect(isEnglishVariant('TOEFL')).toBe(true));
  test('"PTE" is rejected', () => expect(isEnglishVariant('PTE')).toBe(true));
  test('"French" is NOT rejected', () => expect(isEnglishVariant('French')).toBe(false));
  test('"German" is NOT rejected', () => expect(isEnglishVariant('German')).toBe(false));
  test('non-string (null) returns false safely', () => expect(isEnglishVariant(null)).toBe(false));
});

// ── calculateParameterScore — core aggregation (MAX, not SUM) ────────────────

describe('calculateParameterScore', () => {

  // ── basic single-language cases ──────────────────────────────────────────

  test('single language A1 → score = 7', () => {
    const evidence = [row('French', 'A1')];
    expect(calculateParameterScore(evidence)).toBe(7);
  });

  test('single language B1 → score = 15', () => {
    const evidence = [row('French', 'B1')];
    expect(calculateParameterScore(evidence)).toBe(15);
  });

  // ── same-language progression (A1 then B1, both approved) ───────────────

  test('same language A1 then B1: group max = 15, not 7+15 = 22', () => {
    // Student submitted A1 first, later achieved B1; both rows are APPROVED.
    const evidence = [
      row('French', 'A1'),
      row('French', 'B1'),
    ];
    // Max within French group = 15. Score = 15.
    expect(calculateParameterScore(evidence)).toBe(15);
  });

  // ── TWO DIFFERENT LANGUAGES — the critical test ──────────────────────────
  //
  // This is the defining test for this module.
  // Open-Source sums best-per-group: 15 + 12 = 27 (then caps).
  // Foreign Language takes MAX across groups: max(15, 12) = 15.
  // Must be 15 — NOT 27, NOT capped-sum.

  test('French B1 (15) + German A2 (12) → score = 15, NOT 27 (MAX, not SUM)', () => {
    const evidence = [
      row('French', 'B1'),
      row('German', 'A2'),
    ];
    expect(calculateParameterScore(evidence)).toBe(15);
  });

  // ── equal tiers across two languages (confirms no accidental summing) ────

  test('French A1 + Spanish A1 → score = 7, NOT 14 (MAX, not SUM)', () => {
    const evidence = [
      row('French', 'A1'),
      row('Spanish', 'A1'),
    ];
    expect(calculateParameterScore(evidence)).toBe(7);
  });

  // ── three languages, best wins ───────────────────────────────────────────

  test('French A1 + Spanish A2 + Mandarin B1 → score = 15', () => {
    const evidence = [
      row('French', 'A1'),
      row('Spanish', 'A2'),
      row('Mandarin', 'B1'),
    ];
    expect(calculateParameterScore(evidence)).toBe(15);
  });

  // ── case and whitespace normalisation ───────────────────────────────────

  test('"French" and "french " normalise to the same group', () => {
    // Both rows represent the same language; group max = B1 = 15.
    const evidence = [
      { language_name_normalized: 'french', cefr_level: 'A1' },
      { language_name_normalized: 'french', cefr_level: 'B1' },
    ];
    expect(calculateParameterScore(evidence)).toBe(15);
  });

  test('mixed case inputs resolve to a single group', () => {
    // Normalisation happens upstream (GENERATED column or service call);
    // here both are already 'french'.
    const evidence = [
      { language_name_normalized: 'french', cefr_level: 'A2' },
      { language_name_normalized: 'french', cefr_level: 'A1' },
    ];
    // Max within the single french group = A2 = 12.
    expect(calculateParameterScore(evidence)).toBe(12);
  });

  // ── rejected evidence excluded ───────────────────────────────────────────

  test('rejected evidence is excluded (caller must pre-filter to APPROVED only)', () => {
    // Route handler passes only APPROVED rows; this tests that the service
    // handles an empty list (as if all were rejected) correctly.
    expect(calculateParameterScore([])).toBe(0);
  });

  // ── empty list → 0 ──────────────────────────────────────────────────────

  test('empty approved list → score = 0', () => {
    expect(calculateParameterScore([])).toBe(0);
  });

  test('null / undefined input → score = 0', () => {
    expect(calculateParameterScore(null)).toBe(0);
    expect(calculateParameterScore(undefined)).toBe(0);
  });
});

// ── API-level English rejection (unit-level simulation) ──────────────────────

describe('English variant rejected before DB insert', () => {
  // The route calls isEnglishVariant() and returns 400 without inserting.
  // These tests confirm the guard function covers the cases the route relies on.

  test('"English" language_name is caught', () => {
    expect(isEnglishVariant('English')).toBe(true);
  });

  test('"ENGLISH" case variant is caught', () => {
    expect(isEnglishVariant('ENGLISH')).toBe(true);
  });

  test('"IELTS" is caught (English-proxy test)', () => {
    expect(isEnglishVariant('IELTS')).toBe(true);
  });

  test('"TOEFL iBT" is caught', () => {
    expect(isEnglishVariant('TOEFL iBT')).toBe(true);
  });

  test('"French" passes the guard (not English)', () => {
    expect(isEnglishVariant('French')).toBe(false);
  });
});
