/**
 * Register numbers are treated as text. Normalize only for matching —
 * always store originals separately.
 */
function normalizeRegisterNumber(raw) {
  if (!raw) return '';
  return String(raw).trim().toUpperCase();
}

function normalizeName(raw) {
  if (!raw) return '';
  return String(raw).trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Returns true if names are close enough to be considered the same person.
 * Exact match after normalization is required; no fuzzy matching to avoid
 * awarding marks to the wrong student.
 */
function namesMatch(nameA, nameB) {
  return normalizeName(nameA) === normalizeName(nameB);
}

module.exports = { normalizeRegisterNumber, normalizeName, namesMatch };
