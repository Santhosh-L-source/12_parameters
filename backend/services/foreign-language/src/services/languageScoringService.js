'use strict';

// ── Foreign Language Proficiency — Parameter MAX 15 ────────────────────────
//
// AGGREGATION RULE: MAX-across-language-groups (NOT sum).
//
// This differs intentionally from the Open-Source module's SUM-across-groups
// pattern. A student who is B1 in French (15 marks) AND A2 in German (12 marks)
// scores 15, not 27 or a capped 15+12. Only the single best language counts,
// per the spec: "Highest verified level in ONE non-English language only."
//
// B2/C1/C2 are accepted as valid CEFR levels (stored accurately) but earn the
// same marks as B1 since 15 is MAX_MARKS and the framework currently caps there.
// If the spec ever assigns extra marks to B2+, update cefrToMarks() only.

const MAX_MARKS = 15;

// English variants and English-proxying test names that must be rejected at
// submission time. Checked case-insensitively after trimming.
const ENGLISH_DISALLOWLIST = new Set([
  'english',
  'english language',
  'english (efl)',
  'english as a foreign language',
  'english efl',
  'english esl',
  'ielts',
  'toefl',
  'toefl ibt',
  'toefl pbt',
  'pte',
  'pte academic',
  'cambridge english',
  'english proficiency',
  'english admission test',
]);

/**
 * Returns true when the given language name must be rejected for this parameter.
 * Covers explicit "English" entries and English-proxy certifications.
 *
 * @param {string} languageName
 * @returns {boolean}
 */
function isEnglishVariant(languageName) {
  if (typeof languageName !== 'string') return false;
  const normalized = languageName.toLowerCase().trim();
  return ENGLISH_DISALLOWLIST.has(normalized);
}

/**
 * Maps a CEFR level string to the marks awarded under this parameter.
 *
 * A1 → 7  |  A2 → 12  |  B1+ → 15
 * B2/C1/C2 earn the same 15 as B1 (spec cap = MAX_MARKS; higher tiers add nothing).
 * Unrecognised input returns 0 so corrupted data doesn't break aggregation.
 *
 * @param {string} cefrLevel
 * @returns {number}
 */
function cefrToMarks(cefrLevel) {
  switch (cefrLevel) {
    case 'A1': return 7;
    case 'A2': return 12;
    case 'B1': return 15;
    case 'B2': return 15;  // at-or-above B1 ceiling; 15 = MAX_MARKS
    case 'C1': return 15;
    case 'C2': return 15;
    default:   return 0;
  }
}

/**
 * Calculates the Foreign Language parameter score from a list of APPROVED
 * evidence rows.
 *
 * Algorithm — MAX-across-language-groups (NOT sum):
 *   1. Group rows by language_name_normalized.
 *   2. For each language group, take the MAX marks reached in that language.
 *   3. Return the MAX across all language groups.
 *
 * @param {Array<{language_name_normalized: string, cefr_level: string}>} approvedEvidenceList
 * @returns {number}  0 – MAX_MARKS (0–15)
 */
function calculateParameterScore(approvedEvidenceList) {
  if (!Array.isArray(approvedEvidenceList) || approvedEvidenceList.length === 0) {
    return 0;
  }

  // Step 1: group by normalized language name → best marks per language.
  const bestMarksByLanguage = new Map();

  for (const row of approvedEvidenceList) {
    const lang = row.language_name_normalized;
    const marks = cefrToMarks(row.cefr_level);
    const current = bestMarksByLanguage.get(lang);
    if (current === undefined || marks > current) {
      bestMarksByLanguage.set(lang, marks);
    }
  }

  // Step 2: MAX across all language groups (NOT sum).
  let score = 0;
  for (const marks of bestMarksByLanguage.values()) {
    if (marks > score) {
      score = marks;
    }
  }

  return score;
}

module.exports = { cefrToMarks, calculateParameterScore, isEnglishVariant, ENGLISH_DISALLOWLIST, MAX_MARKS };
