const config = require('../config/config');

function extractHandle(platform, profileUrl) {
  const platConf = config.platforms[platform];
  if (!platConf) return null;
  if (platConf.extractHandle) return platConf.extractHandle(profileUrl);
  if (platConf.extractId) {
    const result = platConf.extractId(profileUrl);
    return result ? result.id : null;
  }
  return null;
}

function normalizeName(handle) {
  if (!handle) return '';
  return handle
    .toLowerCase()
    .replace(/[0-9_\-\.]/g, '')
    .trim();
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const longer = na.length >= nb.length ? na : nb;
  const shorter = na.length < nb.length ? na : nb;

  if (longer.includes(shorter) || shorter.includes(longer)) return 0.9;

  let matches = 0;
  const used = new Set();
  for (const ch of shorter) {
    for (let i = 0; i < longer.length; i++) {
      if (!used.has(i) && longer[i] === ch) {
        matches++;
        used.add(i);
        break;
      }
    }
  }
  return matches / longer.length;
}

function checkHandleMismatch(newPlatform, newUrl, existingRecords) {
  if (!existingRecords || existingRecords.length === 0) return null;

  const newHandle = extractHandle(newPlatform, newUrl);
  if (!newHandle) return null;

  const existingHandles = existingRecords
    .filter((r) => r.platform !== newPlatform && r.profileUrl)
    .map((r) => ({
      platform: r.platform,
      handle: extractHandle(r.platform, r.profileUrl),
    }))
    .filter((h) => h.handle);

  if (existingHandles.length === 0) return null;

  const scores = existingHandles.map((eh) => ({
    ...eh,
    score: similarity(newHandle, eh.handle),
  }));

  const bestMatch = scores.reduce((a, b) => (a.score > b.score ? a : b));

  if (bestMatch.score < 0.5) {
    return {
      warning: `Handle "${newHandle}" looks very different from your other profiles (e.g. "${bestMatch.handle}" on ${bestMatch.platform}). Make sure this is your own profile.`,
      newHandle,
      scores,
    };
  }

  return null;
}

module.exports = { checkHandleMismatch, similarity, normalizeName, extractHandle };
