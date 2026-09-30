const calculateAccumulativeScore = require('../src/utils/calculateAccumulativeScore');

describe('calculateAccumulativeScore', () => {
  it('returns 0 for empty list', () => {
    expect(calculateAccumulativeScore([], 'processOrStartupName', 20)).toBe(0);
  });

  it('picks max per distinct key', () => {
    const list = [
      { processOrStartupName: 'Google', stageMarks: 4 },
      { processOrStartupName: 'Google', stageMarks: 10 },
      { processOrStartupName: 'Amazon', stageMarks: 6 },
    ];
    expect(calculateAccumulativeScore(list, 'processOrStartupName', 20)).toBe(16);
  });

  it('caps at maxCap', () => {
    const list = [
      { processOrStartupName: 'Google', stageMarks: 15 },
      { processOrStartupName: 'Amazon', stageMarks: 15 },
    ];
    expect(calculateAccumulativeScore(list, 'processOrStartupName', 20)).toBe(20);
  });

  it('normalizes keys case-insensitively', () => {
    const list = [
      { processOrStartupName: 'Google', stageMarks: 4 },
      { processOrStartupName: 'google', stageMarks: 10 },
    ];
    expect(calculateAccumulativeScore(list, 'processOrStartupName', 20)).toBe(10);
  });

  it('handles mixed recruitment and startup tracks', () => {
    const list = [
      { processOrStartupName: 'Google Internship', stageMarks: 10 },
      { processOrStartupName: 'My Startup', stageMarks: 8 },
    ];
    expect(calculateAccumulativeScore(list, 'processOrStartupName', 20)).toBe(18);
  });
});

describe('stages config', () => {
  const { RECRUITMENT_STAGES, STARTUP_STAGES, getStagesForTrack } = require('../src/config/stages');

  it('recruitment stages have correct marks', () => {
    expect(RECRUITMENT_STAGES.OA_COMPLETED).toBe(2);
    expect(RECRUITMENT_STAGES.INTERNSHIP_OFFER).toBe(10);
    expect(RECRUITMENT_STAGES.PPO_PPI).toBe(20);
  });

  it('startup stages have correct marks', () => {
    expect(STARTUP_STAGES.STARTUP_SHORTLIST).toBe(3);
    expect(STARTUP_STAGES.RECOGNISED_INCUBATOR).toBe(8);
    expect(STARTUP_STAGES.FUNDING_AWARD).toBe(20);
  });

  it('getStagesForTrack returns correct stages', () => {
    expect(getStagesForTrack('RECRUITMENT')).toBe(RECRUITMENT_STAGES);
    expect(getStagesForTrack('STARTUP')).toBe(STARTUP_STAGES);
  });
});
