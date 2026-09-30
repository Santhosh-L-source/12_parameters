const { calculateResult, convertToMark } = require('../src/services/scoring');

// ── convertToMark band boundaries ────────────────────────────────────────────

describe('convertToMark', () => {
  test('below 50 → 0',    () => expect(convertToMark(49.99)).toBe(0));
  test('exactly 50 → 5',  () => expect(convertToMark(50)).toBe(5));
  test('59.99 → 5',       () => expect(convertToMark(59.99)).toBe(5));
  test('exactly 60 → 10', () => expect(convertToMark(60)).toBe(10));
  test('69.99 → 10',      () => expect(convertToMark(69.99)).toBe(10));
  test('exactly 70 → 15', () => expect(convertToMark(70)).toBe(15));
  test('79.99 → 15',      () => expect(convertToMark(79.99)).toBe(15));
  test('exactly 80 → 20', () => expect(convertToMark(80)).toBe(20));
  test('100 → 20',        () => expect(convertToMark(100)).toBe(20));
});

// ── Semester 1: no prior scores ───────────────────────────────────────────────

describe('Semester 1', () => {
  test('avg of 3 scores, no prior history', () => {
    const { cumulativeAvg, convertedMark } = calculateResult([], 60, 70, 80);
    expect(cumulativeAvg).toBeCloseTo(70);
    expect(convertedMark).toBe(15);
  });

  test('all scores 50 → mark 5', () => {
    const { cumulativeAvg, convertedMark } = calculateResult([], 50, 50, 50);
    expect(cumulativeAvg).toBeCloseTo(50);
    expect(convertedMark).toBe(5);
  });
});

// ── Cumulative history transitions ───────────────────────────────────────────

// priorRawScores is a flat array of all raw_score values from previous semesters

describe('Semester 2 — cumulative over 6 scores', () => {
  test('sem1 avg 60, sem2 scores 80,80,80 → cumulative avg 70 → mark 15', () => {
    const { cumulativeAvg, convertedMark } = calculateResult([60, 60, 60], 80, 80, 80);
    expect(cumulativeAvg).toBeCloseTo(70);
    expect(convertedMark).toBe(15);
  });
});

describe('Semester 3 — cumulative over 9 scores', () => {
  // sem1: 60,60,60 | sem2: 80,80,80 → prior avg 70, add sem3 90,90,90 → (420+270)/9 = 76.67
  test('prior [60×3, 80×3], sem3 scores 90,90,90 → ~76.67 → mark 15', () => {
    const { cumulativeAvg, convertedMark } = calculateResult([60, 60, 60, 80, 80, 80], 90, 90, 90);
    expect(cumulativeAvg).toBeCloseTo(76.67, 1);
    expect(convertedMark).toBe(15);
  });
});

describe('Semester 4 — cumulative over 12 scores', () => {
  test('all prior 80, sem4 all 80 → cumulative avg 80 → mark 20', () => {
    const prior = Array(9).fill(80);
    const { cumulativeAvg, convertedMark } = calculateResult(prior, 80, 80, 80);
    expect(cumulativeAvg).toBeCloseTo(80);
    expect(convertedMark).toBe(20);
  });
});

describe('Semester 5 — cumulative over 15 scores', () => {
  test('all prior 40, sem5 all 40 → cumulative 40 → mark 0', () => {
    const prior = Array(12).fill(40);
    const { cumulativeAvg, convertedMark } = calculateResult(prior, 40, 40, 40);
    expect(cumulativeAvg).toBeCloseTo(40);
    expect(convertedMark).toBe(0);
  });
});

describe('Semester 6 — cumulative over all 18 scores', () => {
  test('all prior 50, sem6 all 50 → cumulative 50 → mark 5', () => {
    const prior = Array(15).fill(50);
    const { cumulativeAvg, convertedMark } = calculateResult(prior, 50, 50, 50);
    expect(cumulativeAvg).toBeCloseTo(50);
    expect(convertedMark).toBe(5);
  });
});

// ── Incomplete history ────────────────────────────────────────────────────────

describe('Incomplete history', () => {
  test('sem 3 submitted with only sem 1 raw scores in history (sem 2 missing)', () => {
    // Only 3 prior scores (sem1), not 6 — sem2 was never submitted.
    // (70+70+70+90+90+90)/6 = 480/6 = 80
    const { cumulativeAvg, convertedMark } = calculateResult([70, 70, 70], 90, 90, 90);
    expect(cumulativeAvg).toBeCloseTo(80);
    expect(convertedMark).toBe(20);
  });
});
