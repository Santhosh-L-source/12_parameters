-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS gate_evidence (
  id                          SERIAL PRIMARY KEY,
  student_id                  BIGINT NOT NULL,
  semester_id                 INTEGER NOT NULL,
  diagnostic_completed        BOOLEAN NOT NULL DEFAULT false,
  tests_completed             INTEGER NOT NULL DEFAULT 0,
  full_length_tests_completed INTEGER NOT NULL DEFAULT 0,
  average_score_percent       DECIMAL(5,2) NOT NULL DEFAULT 0,
  official_appearance         BOOLEAN NOT NULL DEFAULT false,
  qualified                   BOOLEAN NOT NULL DEFAULT false,
  gate_score                  INTEGER,
  branch_code                 VARCHAR(20) NOT NULL,
  optional_exam_type          VARCHAR(10) CHECK (optional_exam_type IN ('GRE','GMAT','CAT','TOEFL','IELTS','PTE')),
  optional_scorecard_valid    BOOLEAN NOT NULL DEFAULT false,
  central_threshold_met       BOOLEAN NOT NULL DEFAULT false,
  proof_url                   TEXT,
  status                      VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  mentor_id                   BIGINT,
  verified_at                 TIMESTAMPTZ,
  core_tier                   INTEGER,
  bonus                       INTEGER,
  final_score                 INTEGER,
  flag_missing_calibration    BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gate_branch_calibration (
  id                    SERIAL PRIMARY KEY,
  branch_code           VARCHAR(20) NOT NULL,
  min_qualifying_score  INTEGER NOT NULL,
  min_score_for_25_marks INTEGER NOT NULL,
  effective_from        DATE NOT NULL,
  effective_to          DATE,
  updated_by            BIGINT NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_branch_date
  ON gate_branch_calibration (branch_code, effective_from DESC);

-- Optional: disable RLS for demo (service-role key bypasses it anyway, but keeps things simple)
ALTER TABLE gate_evidence           DISABLE ROW LEVEL SECURITY;
ALTER TABLE gate_branch_calibration DISABLE ROW LEVEL SECURITY;
