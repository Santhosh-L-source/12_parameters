-- Migration 003: Reset to standalone schema with TEXT identifiers
-- and add JLPT-specific fields (level, score, cert_date).
-- WARNING: drops all existing data. Run only on empty tables.

DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS language_evidence CASCADE;

-- ── language_evidence ─────────────────────────────────────────────────────────

CREATE TABLE language_evidence (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  register_number          TEXT        NOT NULL,
  semester                 TEXT        NOT NULL,
  language_name            TEXT        NOT NULL,
  language_name_normalized TEXT        GENERATED ALWAYS AS (lower(trim(language_name))) STORED,
  cefr_level               TEXT        NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  certifying_body          TEXT,
  -- JLPT-specific fields (NULL for non-JLPT exams)
  jlpt_level               TEXT        CHECK (jlpt_level IN ('N1','N2','N3','N4','N5')),
  jlpt_score               INTEGER,
  cert_date                DATE,
  proof_url                TEXT,
  status                   TEXT        NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  mentor_id                TEXT,
  submitted_at             TIMESTAMPTZ DEFAULT now(),
  verified_at              TIMESTAMPTZ,
  CONSTRAINT no_english CHECK (
    lower(trim(language_name)) NOT IN ('english','english language','english (efl)')
  )
);

CREATE INDEX idx_language_reg_semester ON language_evidence(register_number, semester);
CREATE INDEX idx_language_status       ON language_evidence(status);

ALTER TABLE language_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_insert" ON language_evidence FOR INSERT WITH CHECK (true);
CREATE POLICY "server_select" ON language_evidence FOR SELECT USING (true);
CREATE POLICY "server_update" ON language_evidence FOR UPDATE USING (true) WITH CHECK (true);

-- ── scores ────────────────────────────────────────────────────────────────────

CREATE TABLE scores (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  register_number  TEXT        NOT NULL,
  semester         TEXT        NOT NULL,
  parameter        TEXT        NOT NULL,
  marks            INTEGER     NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scores_unique UNIQUE (register_number, semester, parameter)
);

CREATE INDEX idx_scores_reg_semester ON scores(register_number, semester);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_insert" ON scores FOR INSERT WITH CHECK (true);
CREATE POLICY "scores_select" ON scores FOR SELECT USING (true);
CREATE POLICY "scores_update" ON scores FOR UPDATE USING (true) WITH CHECK (true);
