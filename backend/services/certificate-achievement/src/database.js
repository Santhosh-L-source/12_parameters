const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'submissions.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDb() {
  const conn = getDb();
  conn.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id             TEXT PRIMARY KEY,
      student_name   TEXT NOT NULL,
      roll_number    TEXT NOT NULL,
      semester       TEXT NOT NULL,
      department     TEXT NOT NULL,
      email          TEXT DEFAULT '',
      cert_filename  TEXT DEFAULT '',
      cert_saved_path TEXT DEFAULT '',
      submitted_at   TEXT NOT NULL,
      final_status   TEXT NOT NULL,
      marks_awarded  INTEGER DEFAULT 0,
      matched_cert   TEXT DEFAULT '',
      cert_tier      TEXT DEFAULT '',
      name_on_cert   TEXT DEFAULT '',
      name_match     INTEGER DEFAULT 0,
      url_status     TEXT DEFAULT '',
      verification_json  TEXT DEFAULT '{}',
      mentor_actions TEXT DEFAULT '[]',
      mentor_reasons TEXT DEFAULT '[]',
      mentor_decision   TEXT DEFAULT 'PENDING',
      mentor_comment    TEXT DEFAULT '',
      mentor_reviewed_at TEXT DEFAULT ''
    )
  `);

  try {
    conn.exec("ALTER TABLE submissions ADD COLUMN cert_saved_path TEXT DEFAULT ''");
  } catch { /* column already exists */ }
}

function saveSubmission(subId, data) {
  const conn = getDb();
  const steps = data.steps || {};
  const matrix = steps.matrix || {};
  const name = steps.name_match || {};
  const url = steps.url_verification || {};

  const mentorDecision = (data.final_status || '').includes('MENTOR') ? 'PENDING' : 'N/A';
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const stmt = conn.prepare(`
    INSERT OR REPLACE INTO submissions
    (id, student_name, roll_number, semester, department, email,
     cert_filename, cert_saved_path, submitted_at, final_status, marks_awarded,
     matched_cert, cert_tier, name_on_cert, name_match, url_status,
     verification_json, mentor_actions, mentor_reasons, mentor_decision)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  stmt.run(
    subId,
    data.student_name || '',
    data.roll_number || '',
    data.semester || '',
    data.department || '',
    data.email || '',
    data.cert_filename || '',
    data.cert_saved_path || '',
    now,
    data.final_status || '',
    data.marks_awarded || 0,
    matrix.matched_entry || '',
    (steps.marks || {}).tier || '',
    (name.cert_name) || '',
    name.match ? 1 : 0,
    (url.status) || 'NOT PRESENT',
    JSON.stringify(data.steps || {}),
    JSON.stringify(data.mentor_action || []),
    JSON.stringify(data.reason || []),
    mentorDecision
  );
}

function getAllSubmissions() {
  const conn = getDb();
  return conn.prepare('SELECT * FROM submissions ORDER BY submitted_at DESC').all();
}

function getSubmission(subId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM submissions WHERE id=?').get(subId) || null;
}

function updateMentorDecision(subId, decision, comment) {
  const conn = getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  conn.prepare(`
    UPDATE submissions
    SET mentor_decision=?, mentor_comment=?, mentor_reviewed_at=?
    WHERE id=?
  `).run(decision, comment, now, subId);
}

function getStudentSubmissions(rollNumber) {
  const conn = getDb();
  return conn.prepare(
    'SELECT * FROM submissions WHERE roll_number=? ORDER BY submitted_at DESC'
  ).all(rollNumber);
}

function getStats() {
  const conn = getDb();
  const total = conn.prepare("SELECT COUNT(*) as c FROM submissions").get().c;
  const pending = conn.prepare("SELECT COUNT(*) as c FROM submissions WHERE mentor_decision='PENDING'").get().c;
  const eligible = conn.prepare("SELECT COUNT(*) as c FROM submissions WHERE final_status='ELIGIBLE'").get().c;
  const approved = conn.prepare("SELECT COUNT(*) as c FROM submissions WHERE mentor_decision='APPROVED'").get().c;
  const rejected = conn.prepare("SELECT COUNT(*) as c FROM submissions WHERE mentor_decision='REJECTED'").get().c;
  return { total, pending, eligible, approved, rejected };
}

module.exports = { initDb, saveSubmission, getAllSubmissions, getSubmission, updateMentorDecision, getStudentSubmissions, getStats };
