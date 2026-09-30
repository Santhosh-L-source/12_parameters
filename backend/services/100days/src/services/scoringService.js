const MARK_BY_BATCH = {
  PEP: 5,
  HOPE_NON_ELITE: 10,
  HOPE_ELITE: 15,
};

const CATEGORY_LABEL = {
  PEP: 'PEP Training Batch',
  HOPE_NON_ELITE: 'HOPE Non-Elite Training Batch',
  HOPE_ELITE: 'HOPE Elite Training Batch',
};

/**
 * Recalculate scores for all affected students after a list is approved.
 * Operates on all students who have at least one entry in any APPROVED list.
 * Writes to hundred_days_scores and appends to hundred_days_audit_log.
 *
 * @param {object} db  - pg Pool or Client
 * @param {number} triggerListId  - the list that triggered this recalculation
 * @param {number} triggeredByUserId
 * @returns {object} scoreSummary
 */
async function recalculateAll(db, triggerListId, triggeredByUserId) {
  // Get all students that appear (MATCHED) in any currently APPROVED list
  const { rows: affected } = await db.query(`
    SELECT DISTINCT e.matched_student_id AS student_id
    FROM hundred_days_entries e
    JOIN hundred_days_lists l ON l.id = e.list_id
    WHERE e.match_status = 'MATCHED'
      AND l.status = 'APPROVED'
  `);

  // Also include students who previously had a score (so removals drop them to 0)
  const { rows: previousScores } = await db.query(`
    SELECT student_id FROM hundred_days_scores
  `);

  const studentIds = new Set([
    ...affected.map(r => r.student_id),
    ...previousScores.map(r => r.student_id),
  ]);

  const summary = { increased: 0, decreased: 0, unchanged: 0, zeroed: 0 };

  for (const studentId of studentIds) {
    await recalculateOne(db, studentId, triggerListId, triggeredByUserId, summary);
  }

  return summary;
}

async function recalculateOne(db, studentId, triggerListId, triggeredByUserId, summary = {}) {
  // Find all MATCHED entries for this student in APPROVED lists
  const { rows: entries } = await db.query(`
    SELECT l.batch_type, l.id AS list_id, l.publication_date
    FROM hundred_days_entries e
    JOIN hundred_days_lists l ON l.id = e.list_id
    WHERE e.matched_student_id = $1
      AND e.match_status = 'MATCHED'
      AND l.status = 'APPROVED'
  `, [studentId]);

  const inPep = entries.some(e => e.batch_type === 'PEP');
  const inNonElite = entries.some(e => e.batch_type === 'HOPE_NON_ELITE');
  const inElite = entries.some(e => e.batch_type === 'HOPE_ELITE');

  let awardedMark = 0;
  let awardedCategory = 'Not selected';

  if (inElite) {
    awardedMark = MARK_BY_BATCH.HOPE_ELITE;
    awardedCategory = CATEGORY_LABEL.HOPE_ELITE;
  } else if (inNonElite) {
    awardedMark = MARK_BY_BATCH.HOPE_NON_ELITE;
    awardedCategory = CATEGORY_LABEL.HOPE_NON_ELITE;
  } else if (inPep) {
    awardedMark = MARK_BY_BATCH.PEP;
    awardedCategory = CATEGORY_LABEL.PEP;
  }

  const sourceListIds = [...new Set(entries.map(e => e.list_id))];
  const latestPubDate = entries.reduce((latest, e) => {
    if (!latest || e.publication_date > latest) return e.publication_date;
    return latest;
  }, null);

  // Get student details
  const { rows: [student] } = await db.query(
    `SELECT id, register_number, name FROM students WHERE id = $1`,
    [studentId]
  );

  if (!student) return;

  // Get existing score for audit comparison
  const { rows: [existing] } = await db.query(
    `SELECT awarded_mark, awarded_category FROM hundred_days_scores WHERE student_id = $1`,
    [studentId]
  );

  const prevMark = existing ? existing.awarded_mark : null;
  const prevCategory = existing ? existing.awarded_category : null;

  // Upsert score
  await db.query(`
    INSERT INTO hundred_days_scores
      (student_id, register_number, student_name, in_pep, in_hope_non_elite, in_hope_elite,
       awarded_mark, awarded_category, source_list_ids, last_calculated_at, last_list_publication_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
    ON CONFLICT (student_id) DO UPDATE SET
      register_number           = EXCLUDED.register_number,
      student_name              = EXCLUDED.student_name,
      in_pep                    = EXCLUDED.in_pep,
      in_hope_non_elite         = EXCLUDED.in_hope_non_elite,
      in_hope_elite             = EXCLUDED.in_hope_elite,
      awarded_mark              = EXCLUDED.awarded_mark,
      awarded_category          = EXCLUDED.awarded_category,
      source_list_ids           = EXCLUDED.source_list_ids,
      last_calculated_at        = EXCLUDED.last_calculated_at,
      last_list_publication_date = EXCLUDED.last_list_publication_date
  `, [
    studentId,
    student.register_number,
    student.name,
    inPep,
    inNonElite,
    inElite,
    awardedMark,
    awardedCategory,
    sourceListIds,
    latestPubDate,
  ]);

  // Write audit log only if mark changed
  const markChanged = prevMark === null || prevMark !== awardedMark;
  if (markChanged) {
    await db.query(`
      INSERT INTO hundred_days_audit_log
        (event_type, student_id, register_number, previous_mark, new_mark,
         previous_category, new_category, triggered_by_list_id, triggered_by_user_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      prevMark === null ? 'SCORE_CREATED' : 'SCORE_UPDATED',
      studentId,
      student.register_number,
      prevMark,
      awardedMark,
      prevCategory,
      awardedCategory,
      triggerListId,
      triggeredByUserId,
      null,
    ]);

    if (summary) {
      if (prevMark === null) {
        // first time
      } else if (awardedMark > prevMark) {
        summary.increased = (summary.increased || 0) + 1;
      } else if (awardedMark < prevMark) {
        summary.decreased = (summary.decreased || 0) + 1;
        if (awardedMark === 0) summary.zeroed = (summary.zeroed || 0) + 1;
      }
    }
  } else if (summary) {
    summary.unchanged = (summary.unchanged || 0) + 1;
  }
}

/**
 * Build score distribution counts for a preview/summary report.
 */
async function getScoreDistribution(db) {
  const { rows } = await db.query(`
    SELECT awarded_mark, COUNT(*) AS count
    FROM hundred_days_scores
    GROUP BY awarded_mark
  `);
  const dist = { 0: 0, 5: 0, 10: 0, 15: 0 };
  for (const r of rows) {
    dist[r.awarded_mark] = parseInt(r.count, 10);
  }
  return dist;
}

module.exports = { recalculateAll, recalculateOne, getScoreDistribution, MARK_BY_BATCH, CATEGORY_LABEL };
