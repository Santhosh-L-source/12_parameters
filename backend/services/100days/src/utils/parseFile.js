const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');

const REQUIRED_COLUMNS = ['register_number', 'name'];

/**
 * Accepts a file buffer and mimetype/extension.
 * Returns an array of { register_number, name } raw objects.
 * Throws on unsupported format or missing required columns.
 */
function parseFile(buffer, originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  let rows;

  if (ext === 'csv') {
    rows = parseCSV(buffer);
  } else if (ext === 'xlsx' || ext === 'xls') {
    rows = parseExcel(buffer);
  } else {
    throw new Error(`Unsupported file type: .${ext}. Upload CSV or XLSX.`);
  }

  if (rows.length === 0) {
    throw new Error('File is empty or has no data rows.');
  }

  validateColumns(rows[0]);
  return rows;
}

function parseCSV(buffer) {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records;
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  // Normalize header keys to lowercase with underscores
  return raw.map(row => {
    const normalized = {};
    for (const [k, v] of Object.entries(row)) {
      const key = k.trim().toLowerCase().replace(/\s+/g, '_');
      normalized[key] = v;
    }
    return normalized;
  });
}

function validateColumns(sampleRow) {
  const keys = Object.keys(sampleRow).map(k => k.toLowerCase());
  for (const col of REQUIRED_COLUMNS) {
    if (!keys.includes(col)) {
      throw new Error(`Missing required column: "${col}". File must have: ${REQUIRED_COLUMNS.join(', ')}`);
    }
  }
}

module.exports = { parseFile };
