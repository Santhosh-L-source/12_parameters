-- Run this once in the Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS students (
  id          BIGSERIAL    PRIMARY KEY,
  name        TEXT         NOT NULL,
  roll_number TEXT         NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS assessment_scores (
  id             BIGSERIAL    PRIMARY KEY,
  student_id     BIGINT       NOT NULL REFERENCES students(id),
  semester       INT          NOT NULL CHECK (semester BETWEEN 1 AND 6),
  score_1        NUMERIC(6,2) NOT NULL,
  score_2        NUMERIC(6,2) NOT NULL,
  score_3        NUMERIC(6,2) NOT NULL,
  cumulative_avg NUMERIC(6,2) NOT NULL,
  converted_mark INT          NOT NULL,
  submitted_by   TEXT,
  submitted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, semester)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id                 BIGSERIAL   PRIMARY KEY,
  submitted_name     TEXT,
  submitted_roll     TEXT,
  matched_student_id BIGINT      REFERENCES students(id),
  semester           INT,
  outcome            TEXT        NOT NULL,
  detail             TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
