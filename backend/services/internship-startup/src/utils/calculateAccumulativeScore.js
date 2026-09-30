function calculateAccumulativeScore(evidenceList, distinctKeyField, maxCap) {
  const grouped = {};
  for (const item of evidenceList) {
    const key = (item[distinctKeyField] || '').trim().toLowerCase();
    if (!key) continue;
    const marks = item.stageMarks || item.stage_marks || 0;
    if (!grouped[key] || marks > grouped[key]) {
      grouped[key] = marks;
    }
  }

  const total = Object.values(grouped).reduce((sum, v) => sum + v, 0);
  return Math.min(total, maxCap);
}

module.exports = calculateAccumulativeScore;
