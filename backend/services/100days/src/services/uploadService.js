const path = require('path');
const fs = require('fs');
const { parseFile } = require('../utils/parseFile');
const { matchEntries } = require('./matchingService');

const UPLOAD_DIR = process.env.HD_UPLOAD_DIR || path.join(__dirname, '../../uploads');

/**
 * Process an uploaded file:
 *  1. Parse rows
 *  2. Match against students
 *  3. Save list record (PENDING) and all entries to DB
 *  4. Return validation report
 */
async function processUpload({ file, batchType, publicationDate, uploadedBy, db }) {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // Parse file
  const rows = parseFile(file.buffer, file.originalname);

  // Match against students
  const { entries, summary } = await matchEntries(rows, db);

  // Persist the list record
  const { rows: [list] } = await db.query(`
    INSERT INTO hundred_days_lists
      (batch_type, file_name, file_path, publication_date, uploaded_by, status, version_number)
    SELECT $1, $2, $3, $4::date, $5, 'PENDING',
      COALESCE((
        SELECT MAX(version_number) + 1
        FROM hundred_days_lists
        WHERE batch_type = $1
      ), 1)
    RETURNING *
  `, [batchType, file.originalname, '', publicationDate, uploadedBy]);

  // Save file to disk with list ID in name for traceability
  const safeName = `${list.id}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  fs.writeFileSync(filePath, file.buffer);

  await db.query(`UPDATE hundred_days_lists SET file_path = $1 WHERE id = $2`, [filePath, list.id]);

  // Bulk insert entries
  if (entries.length > 0) {
    const values = entries.map((e, i) => {
      const base = i * 7;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::hd_match_status, $${base + 6}, $${base + 7})`;
    }).join(', ');

    const params = entries.flatMap(e => [
      list.id,
      e.register_number,
      e.name_in_file,
      e.matched_student_id,
      e.match_status,
      e.raw_register_number,
      e.raw_name,
    ]);

    await db.query(
      `INSERT INTO hundred_days_entries
         (list_id, register_number, name_in_file, matched_student_id, match_status, raw_register_number, raw_name)
       VALUES ${values}`,
      params
    );
  }

  return {
    listId: list.id,
    batchType,
    versionNumber: list.version_number,
    summary: {
      ...summary,
      totalProcessed: entries.length,
    },
  };
}

module.exports = { processUpload };
