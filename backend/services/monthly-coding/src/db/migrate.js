require('dotenv').config();
const pool = require('./index');

const SQL = `
CREATE TABLE IF NOT EXISTS students (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  roll_number VARCHAR(50)  NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS assessment_scores (
  id             SERIAL PRIMARY KEY,
  student_id     INTEGER     NOT NULL REFERENCES students(id),
  semester       INTEGER     NOT NULL CHECK (semester BETWEEN 1 AND 6),
  score_1        NUMERIC(6,2) NOT NULL,
  score_2        NUMERIC(6,2) NOT NULL,
  score_3        NUMERIC(6,2) NOT NULL,
  cumulative_avg NUMERIC(6,2) NOT NULL,
  converted_mark INTEGER      NOT NULL,
  submitted_by   VARCHAR(255),
  submitted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, semester)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id                 SERIAL PRIMARY KEY,
  submitted_name     VARCHAR(255),
  submitted_roll     VARCHAR(50),
  matched_student_id INTEGER REFERENCES students(id),
  semester           INTEGER,
  outcome            VARCHAR(30) NOT NULL,
  detail             TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

(async () => {
  await pool.query(SQL);
  console.log('Migration complete.');
  await pool.end();
})();
