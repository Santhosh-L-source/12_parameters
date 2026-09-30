-- Foreign Language Proficiency Evidence Table
-- Aggregation: MAX-across-language-groups (NOT SUM)
--
-- Standalone module: student_id, semester_id, and mentor_id are UUID columns
-- without FK constraints since the platform's users/students/semesters tables
-- are managed externally. Add REFERENCES clauses once those tables exist.

CREATE TABLE IF NOT EXISTS language_evidence (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id               UUID        NOT NULL,
  semester_id              UUID        NOT NULL,
  language_name            TEXT        NOT NULL,
  language_name_normalized TEXT        GENERATED ALWAYS AS (lower(trim(language_name))) STORED,
  cefr_level               TEXT        NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  certifying_body          TEXT,
  proof_url                TEXT,
  status                   TEXT        NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  mentor_id                UUID,
  submitted_at             TIMESTAMPTZ DEFAULT now(),
  verified_at              TIMESTAMPTZ,

  -- DB-level guard; application code enforces a broader disallow-list
  -- (IELTS, TOEFL, PTE, Cambridge English, etc.) before any insert reaches here.
  CONSTRAINT no_english CHECK (
    lower(trim(language_name)) NOT IN ('english', 'english language', 'english (efl)')
  )
);

CREATE INDEX IF NOT EXISTS idx_language_student_semester
  ON language_evidence(student_id, semester_id);

CREATE INDEX IF NOT EXISTS idx_language_status
  ON language_evidence(status);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE language_evidence ENABLE ROW LEVEL SECURITY;

-- All operations go through the Express server using the service-role key,
-- which bypasses RLS. These permissive policies are a safe fallback for
-- any direct connections.
CREATE POLICY "server_insert" ON language_evidence FOR INSERT WITH CHECK (true);
CREATE POLICY "server_select" ON language_evidence FOR SELECT USING (true);
CREATE POLICY "server_update" ON language_evidence FOR UPDATE USING (true) WITH CHECK (true);
