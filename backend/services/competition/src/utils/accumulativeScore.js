function calculateAccumulativeScore(approvedEvidenceList, distinctKeyField, maxCap) {
  if (!approvedEvidenceList || approvedEvidenceList.length === 0) return 0;
  const groups = {};
  for (const ev of approvedEvidenceList) {
    const key = (ev[distinctKeyField] || '').toLowerCase().trim();
    if (!key) continue;
    const marks = ev.stageMarks || 0;
    if (!groups[key] || marks > groups[key]) {
      groups[key] = marks;
    }
  }
  let sum = 0;
  for (const key of Object.keys(groups)) {
    sum += groups[key];
  }
  return Math.min(sum, maxCap);
}

module.exports = { calculateAccumulativeScore };
