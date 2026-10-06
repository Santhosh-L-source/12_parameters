const { processUpload } = require('../services/uploadService');
const { recalculateAll, getScoreDistribution, MARK_BY_BATCH } = require('../services/scoringService');

const VALID_BATCH_TYPES = ['PEP', 'HOPE_NON_ELITE', 'HOPE_ELITE'];

// POST /admin/hundred-days/lists/upload
async function uploadList(req, res) {
  try {
    const { batch_type, publication_date } = req.body;

    if (!VALID_BATCH_TYPES.includes(batch_type)) {
      return res.status(400).json({ error: `batch_type must be one of: ${VALID_BATCH_TYPES.join(', ')}` });
    }
    if (!publication_date || isNaN(Date.parse(publication_date))) {
      return res.status(400).json({ error: 'publication_date is required (YYYY-MM-DD)' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = req.app.get('db');
    const result = await processUpload({
      file: req.file,
      batchType: batch_type,
      publicationDate: publication_date,
      uploadedBy: req.user.id,
      db,
    });

    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// GET /admin/hundred-days/lists/:id/preview
async function previewList(req, res) {
  try {
    const db = req.app.get('db');
    const listId = parseInt(req.params.id, 10);

    const { rows: [list] } = await db.query(
      `SELECT * FROM hundred_days_lists WHERE id = $1`, [listId]
    );
    if (!list) return res.status(404).json({ error: 'List not found' });

    const { rows: entries } = await db.query(
      `SELECT match_status, COUNT(*) AS count
       FROM hundred_days_entries WHERE list_id = $1
       GROUP BY match_status`,
      [listId]
    );

    const countByStatus = { MATCHED: 0, UNMATCHED: 0, NAME_CONFLICT: 0 };
    for (const e of entries) countByStatus[e.match_status] = parseInt(e.count, 10);

    const { rows: unmatched } = await db.query(
      `SELECT register_number, name_in_file FROM hundred_days_entries
       WHERE list_id = $1 AND match_status = 'UNMATCHED' LIMIT 100`,
      [listId]
    );
    // NAME_CONFLICT rows have matched_student_id = NULL, so join on register_number
    const { rows: conflicts } = await db.query(
      `SELECT e.register_number, e.name_in_file, s.name AS name_in_system
       FROM hundred_days_entries e
       JOIN students s ON UPPER(TRIM(s.register_number)) = e.register_number
       WHERE e.list_id = $1 AND e.match_status = 'NAME_CONFLICT' LIMIT 100`,
      [listId]
    );

    return res.json({
      list,
      summary: countByStatus,
      unmatchedRecords: unmatched,
      nameConflicts: conflicts,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /admin/hundred-days/lists/:id/approve
async function approveList(req, res) {
  const db = req.app.get('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const listId = parseInt(req.params.id, 10);
    const { rows: [list] } = await client.query(
      `SELECT * FROM hundred_days_lists WHERE id = $1 FOR UPDATE`, [listId]
    );
    if (!list) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'List not found' });
    }
    if (list.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `List is already ${list.status}` });
    }

    // Publication date guard: warn if this list is older than the current APPROVED list
    // Admin must pass force_older_date=true to override
    const { rows: [currentApproved] } = await client.query(
      `SELECT publication_date FROM hundred_days_lists
       WHERE batch_type = $1 AND status = 'APPROVED'
       ORDER BY publication_date DESC LIMIT 1`,
      [list.batch_type]
    );
    if (currentApproved && list.publication_date < currentApproved.publication_date) {
      if (!req.body.force_older_date) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'This list has an earlier publication date than the currently approved list.',
          current_approved_date: currentApproved.publication_date,
          uploaded_date: list.publication_date,
          hint: 'Pass force_older_date: true to override if this is an authorized correction.',
        });
      }
    }

    // Supersede any previously APPROVED list of the same batch type
    await client.query(
      `UPDATE hundred_days_lists SET status = 'SUPERSEDED'
       WHERE batch_type = $1 AND status = 'APPROVED' AND id != $2`,
      [list.batch_type, listId]
    );

    // Approve this list
    await client.query(
      `UPDATE hundred_days_lists SET status = 'APPROVED' WHERE id = $1`, [listId]
    );

    await client.query('COMMIT');

    // Recalculate scores outside the transaction
    const scoreSummary = await recalculateAll(db, listId, req.user.id);

    // Score distribution after recalculation
    const distribution = await getScoreDistribution(db);

    return res.json({
      message: 'List approved and scores recalculated',
      scoreSummary,
      distribution,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

// POST /admin/hundred-days/lists/:id/reject
async function rejectList(req, res) {
  try {
    const db = req.app.get('db');
    const listId = parseInt(req.params.id, 10);
    const { rows: [list] } = await db.query(
      `SELECT * FROM hundred_days_lists WHERE id = $1`, [listId]
    );
    if (!list) return res.status(404).json({ error: 'List not found' });
    if (list.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot reject a list with status: ${list.status}` });
    }
    await db.query(
      `UPDATE hundred_days_lists SET status = 'REJECTED', notes = $1 WHERE id = $2`,
      [req.body.reason || null, listId]
    );
    return res.json({ message: 'List rejected' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /admin/hundred-days/lists
async function getLists(req, res) {
  try {
    const db = req.app.get('db');
    const { rows } = await db.query(`
      SELECT l.*, u.name AS uploaded_by_name,
        (SELECT COUNT(*) FROM hundred_days_entries e WHERE e.list_id = l.id) AS total_entries,
        (SELECT COUNT(*) FROM hundred_days_entries e WHERE e.list_id = l.id AND e.match_status = 'MATCHED') AS matched_count
      FROM hundred_days_lists l
      LEFT JOIN users u ON u.id = l.uploaded_by
      ORDER BY l.uploaded_at DESC
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /admin/hundred-days/scores
async function getScores(req, res) {
  try {
    const db = req.app.get('db');
    const { batch_type, mark, search } = req.query;
    let query = `SELECT s.*, st.register_number AS student_reg, st.name AS student_name_from_db
                 FROM hundred_days_scores s
                 JOIN students st ON st.id = s.student_id
                 WHERE 1=1`;
    const params = [];

    if (mark !== undefined) {
      params.push(parseInt(mark, 10));
      query += ` AND s.awarded_mark = $${params.length}`;
    }
    if (batch_type === 'PEP') {
      query += ` AND s.in_pep = true`;
    } else if (batch_type === 'HOPE_NON_ELITE') {
      query += ` AND s.in_hope_non_elite = true`;
    } else if (batch_type === 'HOPE_ELITE') {
      query += ` AND s.in_hope_elite = true`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (s.register_number ILIKE $${params.length} OR s.student_name ILIKE $${params.length})`;
    }

    query += ` ORDER BY s.awarded_mark DESC, s.student_name`;

    const { rows } = await db.query(query, params);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /admin/hundred-days/scores/export
async function exportScores(req, res) {
  try {
    const db = req.app.get('db');
    const { rows } = await db.query(`
      SELECT s.register_number, s.student_name, s.in_pep, s.in_hope_non_elite, s.in_hope_elite,
             s.awarded_mark, s.awarded_category, s.last_calculated_at
      FROM hundred_days_scores s
      ORDER BY s.awarded_mark DESC, s.student_name
    `);

    const csv = [
      'register_number,student_name,in_pep,in_hope_non_elite,in_hope_elite,awarded_mark,awarded_category,last_calculated_at',
      ...rows.map(r =>
        [r.register_number, `"${r.student_name}"`, r.in_pep, r.in_hope_non_elite, r.in_hope_elite,
        r.awarded_mark, `"${r.awarded_category}"`, r.last_calculated_at].join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="hundred_days_scores.csv"');
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /admin/hundred-days/audit/:studentId
async function getAuditLog(req, res) {
  try {
    const db = req.app.get('db');
    const studentId = parseInt(req.params.studentId, 10);
    const { rows } = await db.query(`
      SELECT a.*, l.file_name AS list_file_name, l.batch_type, u.name AS triggered_by_name
      FROM hundred_days_audit_log a
      LEFT JOIN hundred_days_lists l ON l.id = a.triggered_by_list_id
      LEFT JOIN users u ON u.id = a.triggered_by_user_id
      WHERE a.student_id = $1
      ORDER BY a.event_at DESC
    `, [studentId]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  uploadList,
  previewList,
  approveList,
  rejectList,
  getLists,
  getScores,
  exportScores,
  getAuditLog,
};
