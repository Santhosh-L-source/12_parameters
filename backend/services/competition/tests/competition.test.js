const { calculateAccumulativeScore } = require('../src/utils/accumulativeScore');

describe('Competition Achievement scoring (MAX 20)', () => {
  test('empty list returns 0', () => {
    expect(calculateAccumulativeScore([], 'eventName', 20)).toBe(0);
  });

  test('null/undefined list returns 0', () => {
    expect(calculateAccumulativeScore(null, 'eventName', 20)).toBe(0);
    expect(calculateAccumulativeScore(undefined, 'eventName', 20)).toBe(0);
  });

  test('single event achievement', () => {
    const list = [{ eventName: 'Smart India Hackathon', stageMarks: 10 }];
    expect(calculateAccumulativeScore(list, 'eventName', 20)).toBe(10);
  });

  test('same event progression takes max only (no double-count)', () => {
    const list = [
      { eventName: 'Smart India Hackathon', stageMarks: 2 },
      { eventName: 'Smart India Hackathon', stageMarks: 6 },
      { eventName: 'Smart India Hackathon', stageMarks: 15 },
    ];
    expect(calculateAccumulativeScore(list, 'eventName', 20)).toBe(15);
  });

  test('multiple distinct events sum up', () => {
    const list = [
      { eventName: 'Smart India Hackathon', stageMarks: 10 },
      { eventName: 'ICPC', stageMarks: 6 },
    ];
    expect(calculateAccumulativeScore(list, 'eventName', 20)).toBe(16);
  });

  test('sum capped at 20', () => {
    const list = [
      { eventName: 'Smart India Hackathon', stageMarks: 15 },
      { eventName: 'ICPC', stageMarks: 10 },
    ];
    expect(calculateAccumulativeScore(list, 'eventName', 20)).toBe(20);
  });

  test('rejected evidence excluded (pre-filtered — only approved passed in)', () => {
    const approved = [{ eventName: 'ICPC', stageMarks: 4 }];
    expect(calculateAccumulativeScore(approved, 'eventName', 20)).toBe(4);
  });

  test('case-insensitive grouping of event names', () => {
    const list = [
      { eventName: 'ICPC', stageMarks: 4 },
      { eventName: 'icpc', stageMarks: 15 },
    ];
    expect(calculateAccumulativeScore(list, 'eventName', 20)).toBe(15);
  });

  test('entries with empty eventName are ignored', () => {
    const list = [
      { eventName: '', stageMarks: 10 },
      { eventName: 'ICPC', stageMarks: 6 },
    ];
    expect(calculateAccumulativeScore(list, 'eventName', 20)).toBe(6);
  });
});
