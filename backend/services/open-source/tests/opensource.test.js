const { calculateAccumulativeScore } = require('../src/utils/accumulativeScore');

describe('Open-Source Module - Accumulative Score', () => {
  test('returns 0 for empty evidence list', () => {
    expect(calculateAccumulativeScore([], 'repoOrProgrammeName', 20)).toBe(0);
  });

  test('single evidence item scores correctly', () => {
    const evidence = [
      { repoOrProgrammeName: 'react', stageMarks: 5 },
    ];
    expect(calculateAccumulativeScore(evidence, 'repoOrProgrammeName', 20)).toBe(5);
  });

  test('takes max stageMarks per distinct repo', () => {
    const evidence = [
      { repoOrProgrammeName: 'react', stageMarks: 5 },
      { repoOrProgrammeName: 'react', stageMarks: 10 },
    ];
    expect(calculateAccumulativeScore(evidence, 'repoOrProgrammeName', 20)).toBe(10);
  });

  test('sums across different repos', () => {
    const evidence = [
      { repoOrProgrammeName: 'react', stageMarks: 10 },
      { repoOrProgrammeName: 'angular', stageMarks: 5 },
    ];
    expect(calculateAccumulativeScore(evidence, 'repoOrProgrammeName', 20)).toBe(15);
  });

  test('caps at maxCap', () => {
    const evidence = [
      { repoOrProgrammeName: 'react', stageMarks: 10 },
      { repoOrProgrammeName: 'angular', stageMarks: 10 },
      { repoOrProgrammeName: 'vue', stageMarks: 10 },
    ];
    expect(calculateAccumulativeScore(evidence, 'repoOrProgrammeName', 20)).toBe(20);
  });

  test('normalizes key case-insensitively', () => {
    const evidence = [
      { repoOrProgrammeName: 'React', stageMarks: 5 },
      { repoOrProgrammeName: 'react', stageMarks: 10 },
      { repoOrProgrammeName: 'REACT', stageMarks: 3 },
    ];
    expect(calculateAccumulativeScore(evidence, 'repoOrProgrammeName', 20)).toBe(10);
  });

  test('ignores items with empty key', () => {
    const evidence = [
      { repoOrProgrammeName: '', stageMarks: 10 },
      { repoOrProgrammeName: 'react', stageMarks: 5 },
    ];
    expect(calculateAccumulativeScore(evidence, 'repoOrProgrammeName', 20)).toBe(5);
  });

  test('handles mixed repos with max per group', () => {
    const evidence = [
      { repoOrProgrammeName: 'repo-a', stageMarks: 5 },
      { repoOrProgrammeName: 'repo-a', stageMarks: 15 },
      { repoOrProgrammeName: 'repo-b', stageMarks: 10 },
      { repoOrProgrammeName: 'repo-b', stageMarks: 5 },
    ];
    // repo-a max=15, repo-b max=10, total=25, cap=20
    expect(calculateAccumulativeScore(evidence, 'repoOrProgrammeName', 20)).toBe(20);
  });
});
