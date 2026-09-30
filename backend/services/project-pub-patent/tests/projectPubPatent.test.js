const { calculateAccumulativeScore } = require('../src/utils/accumulativeScore');

describe('Project/Publication/Patent Module - Accumulative Score', () => {
  test('returns 0 for empty evidence list', () => {
    expect(calculateAccumulativeScore([], 'outputName', 30)).toBe(0);
  });

  test('single evidence item scores correctly', () => {
    const evidence = [
      { outputName: 'My AI App', stageMarks: 10 },
    ];
    expect(calculateAccumulativeScore(evidence, 'outputName', 30)).toBe(10);
  });

  test('takes max stageMarks per distinct output', () => {
    const evidence = [
      { outputName: 'My AI App', stageMarks: 5 },
      { outputName: 'My AI App', stageMarks: 15 },
    ];
    expect(calculateAccumulativeScore(evidence, 'outputName', 30)).toBe(15);
  });

  test('sums across different outputs', () => {
    const evidence = [
      { outputName: 'My AI App', stageMarks: 15 },
      { outputName: 'Research Paper on ML', stageMarks: 10 },
      { outputName: 'Patent for Algorithm', stageMarks: 5 },
    ];
    expect(calculateAccumulativeScore(evidence, 'outputName', 30)).toBe(30);
  });

  test('caps at maxCap of 30', () => {
    const evidence = [
      { outputName: 'Project A', stageMarks: 15 },
      { outputName: 'Project B', stageMarks: 10 },
      { outputName: 'Paper C', stageMarks: 20 },
    ];
    // 15+10+20=45, cap=30
    expect(calculateAccumulativeScore(evidence, 'outputName', 30)).toBe(30);
  });

  test('normalizes key case-insensitively', () => {
    const evidence = [
      { outputName: 'My App', stageMarks: 5 },
      { outputName: 'my app', stageMarks: 15 },
      { outputName: 'MY APP', stageMarks: 10 },
    ];
    expect(calculateAccumulativeScore(evidence, 'outputName', 30)).toBe(15);
  });

  test('ignores items with empty key', () => {
    const evidence = [
      { outputName: '', stageMarks: 10 },
      { outputName: 'Valid Project', stageMarks: 5 },
    ];
    expect(calculateAccumulativeScore(evidence, 'outputName', 30)).toBe(5);
  });

  test('handles mixed types with max per group', () => {
    const evidence = [
      { outputName: 'AI Chatbot', stageMarks: 5 },
      { outputName: 'AI Chatbot', stageMarks: 20 },
      { outputName: 'ML Paper', stageMarks: 15 },
      { outputName: 'ML Paper', stageMarks: 10 },
      { outputName: 'IoT Patent', stageMarks: 10 },
    ];
    // AI Chatbot max=20, ML Paper max=15, IoT Patent max=10, total=45, cap=30
    expect(calculateAccumulativeScore(evidence, 'outputName', 30)).toBe(30);
  });
});
