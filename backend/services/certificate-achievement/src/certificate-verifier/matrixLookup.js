const { APPROVED_MATRIX } = require('./matrix');
const { normalize } = require('./nameMatcher');

function findCertInMatrix(ocrText) {
  const textLower = normalize(ocrText);

  let bestKey = null;
  let bestEntry = null;
  let bestScore = 0;

  for (const [key, entry] of Object.entries(APPROVED_MATRIX)) {
    let score = scoreMatch(textLower, key);
    for (const alias of (entry.aliases || [])) {
      const aliasScore = scoreMatch(textLower, normalize(alias));
      score = Math.max(score, aliasScore);
    }
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
      bestEntry = entry;
    }
  }

  const THRESHOLD = 0.6;

  if (bestScore >= THRESHOLD) {
    const level = detectLevel(textLower, bestEntry);
    return {
      found: true,
      entry: bestEntry,
      matched_key: bestKey,
      detected_level: level,
      reason: `Matched "${bestKey}" (confidence ${Math.round(bestScore * 100)}%).`,
    };
  }

  return {
    found: false, entry: null, matched_key: null, detected_level: null,
    reason: 'No approved certification matched the text on this certificate.',
  };
}

function scoreMatch(text, key) {
  const words = key.split(' ').filter(w => w.length > 2);
  if (!words.length) return 0;
  let hits = 0;
  for (const w of words) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`).test(text)) hits++;
  }
  return hits / words.length;
}

function detectLevel(text, entry) {
  if ((entry.tier || '') !== 'Academic') return null;
  const levels = [
    ['elite+gold', /elite.*gold|gold.*elite/i],
    ['elite+silver', /elite.*silver|silver.*elite/i],
    ['elite', /\belite\b/i],
    ['gold', /\bgold\b/i],
    ['silver', /\bsilver\b/i],
    ['completed', /\bcompleted\b|\bpass\b/i],
  ];
  for (const [name, pattern] of levels) {
    if (pattern.test(text)) return name;
  }
  return null;
}

module.exports = { findCertInMatrix };
