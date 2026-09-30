import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'submissions.db')


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
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
    ''')
    # Migrate existing DB — add column if it doesn't exist yet
    try:
        conn.execute("ALTER TABLE submissions ADD COLUMN cert_saved_path TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass  # column already exists

    conn.commit()
    conn.close()


def save_submission(sub_id: str, data: dict):
    steps = data.get('steps', {})
    matrix = steps.get('matrix', {})
    name   = steps.get('name_match', {})
    url    = steps.get('url_verification', {})

    mentor_decision = 'PENDING' if 'MENTOR' in data.get('final_status', '') else 'N/A'

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT OR REPLACE INTO submissions
        (id, student_name, roll_number, semester, department, email,
         cert_filename, cert_saved_path, submitted_at, final_status, marks_awarded,
         matched_cert, cert_tier, name_on_cert, name_match, url_status,
         verification_json, mentor_actions, mentor_reasons, mentor_decision)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        sub_id,
        data.get('student_name', ''),
        data.get('roll_number', ''),
        data.get('semester', ''),
        data.get('department', ''),
        data.get('email', ''),
        data.get('cert_filename', ''),
        data.get('cert_saved_path', ''),
        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        data.get('final_status', ''),
        data.get('marks_awarded', 0),
        matrix.get('matched_entry', ''),
        steps.get('marks', {}).get('tier', ''),
        name.get('cert_name', ''),
        1 if name.get('match') else 0,
        url.get('status', 'NOT PRESENT'),
        json.dumps(data.get('steps', {})),
        json.dumps(data.get('mentor_action', [])),
        json.dumps(data.get('reason', [])),
        mentor_decision,
    ))
    conn.commit()
    conn.close()


def get_all_submissions():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM submissions ORDER BY submitted_at DESC')
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_submission(sub_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM submissions WHERE id=?', (sub_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def update_mentor_decision(sub_id: str, decision: str, comment: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        UPDATE submissions
        SET mentor_decision=?, mentor_comment=?, mentor_reviewed_at=?
        WHERE id=?
    ''', (decision, comment, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), sub_id))
    conn.commit()
    conn.close()


def get_student_submissions(roll_number: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        'SELECT * FROM submissions WHERE roll_number=? ORDER BY submitted_at DESC',
        (roll_number,)
    )
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_stats():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM submissions")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM submissions WHERE mentor_decision='PENDING'")
    pending = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM submissions WHERE final_status='ELIGIBLE'")
    eligible = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM submissions WHERE mentor_decision='APPROVED'")
    approved = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM submissions WHERE mentor_decision='REJECTED'")
    rejected = c.fetchone()[0]
    conn.close()
    return {
        'total': total,
        'pending': pending,
        'eligible': eligible,
        'approved': approved,
        'rejected': rejected,
    }
