function normalize(name) {
  const ascii = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ascii.toLowerCase().replace(/\s+/g, ' ').trim();
}

function exactMatch(certName, registeredName) {
  const nCert = normalize(certName);
  const nReg = normalize(registeredName);

  if (nCert === nReg) {
    return {
      match: true, cert_name: certName,
      registered_name: registeredName, reason: 'Names match exactly.',
    };
  }

  const reason = describeMismatch(nCert, nReg);
  return {
    match: false, cert_name: certName,
    registered_name: registeredName, reason,
  };
}

function describeMismatch(a, b) {
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));

  if (setsEqual(wordsA, wordsB)) {
    return 'Same words but in different order.';
  }

  const missing = [...wordsB].filter(w => !wordsA.has(w));
  const extra = [...wordsA].filter(w => !wordsB.has(w));
  const parts = [];
  if (missing.length) {
    parts.push(`Word(s) in registered name not on certificate: ${missing.sort().join(', ')}`);
  }
  if (extra.length) {
    parts.push(`Word(s) on certificate not in registered name: ${extra.sort().join(', ')}`);
  }
  if (!parts.length) {
    parts.push('Names differ — may be spelling variation or different script.');
  }
  return parts.join(' | ');
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function findBestNameInOcr(ocrData, registeredName) {
  const candidates = [...(ocrData.name_candidates || [])];
  const allLines = ocrData.lines || [];
  const regLower = normalize(registeredName);

  for (const line of allLines) {
    if (normalize(line).includes(regLower)) {
      candidates.unshift(line);
    }
  }

  if (!candidates.length) {
    return {
      found: false, cert_name: null, match: false,
      reason: 'Could not detect a recipient name in the certificate.',
    };
  }

  let best = candidates[0];
  let bestDist = editDistance(normalize(best), regLower);
  for (let i = 1; i < candidates.length; i++) {
    const d = editDistance(normalize(candidates[i]), regLower);
    if (d < bestDist) { bestDist = d; best = candidates[i]; }
  }

  const result = exactMatch(best, registeredName);
  result.found = true;
  return result;
}

function editDistance(s, t) {
  const m = s.length, n = t.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = s[i - 1] === t[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

module.exports = { normalize, exactMatch, findBestNameInOcr, editDistance };
