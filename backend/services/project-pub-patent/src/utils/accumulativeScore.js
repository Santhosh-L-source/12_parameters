function calculateAccumulativeScore(evidenceList, distinctKeyField, maxCap) {
  const groups = {};

  for (const item of evidenceList) {
    const key = (item[distinctKeyField] || '').toString().trim().toLowerCase();
    if (!key) continue;

    const marks = parseInt(item.stageMarks, 10) || 0;
    if (!groups[key] || marks > groups[key]) {
      groups[key] = marks;
    }
  }

  const total = Object.values(groups).reduce((sum, m) => sum + m, 0);
  return Math.min(total, maxCap);
}

module.exports = { calculateAccumulativeScore };
