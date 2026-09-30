/**
 * Scoring rules:
 *   Sem 1     → average of its 3 raw scores only
 *   Sem 2–6   → cumulative average of ALL raw scores from Sem 1 through current semester
 *   Conversion → <50:0  50-59:5  60-69:10  70-79:15  ≥80:20
 *
 * @param {number[]} priorRawScores  Flat array of raw_score values from ALL semesters < current.
 * @param {number}   s1  First raw score for the current semester submission.
 * @param {number}   s2  Second raw score.
 * @param {number}   s3  Third raw score.
 * @returns {{ cumulativeAvg: number, convertedMark: number }}
 */
function calculateResult(priorRawScores, s1, s2, s3) {
  const allRaw = [...priorRawScores.map(parseFloat), s1, s2, s3].map(Number);
  const cumulativeAvg = allRaw.reduce((sum, v) => sum + v, 0) / allRaw.length;
  return { cumulativeAvg, convertedMark: convertToMark(cumulativeAvg) };
}

function convertToMark(avg) {
  if (avg < 50) return 0;
  if (avg < 60) return 5;
  if (avg < 70) return 10;
  if (avg < 80) return 15;
  return 20;
}

module.exports = { calculateResult, convertToMark };
