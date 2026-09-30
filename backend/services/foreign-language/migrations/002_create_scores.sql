-- Placement-readiness scores table
-- One row per (student, semester, parameter); upserted by each module's verify handler.
--
-- Standalone module: student_id and semester_id are plain UUIDs without FK constraints.

CREATE TABLE IF NOT EXISTS scores (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL,
  semester_id  UUID        NOT NULL,
  parameter    TEXT        NOT NULL,
  marks        INTEGER     NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT scores_unique UNIQUE (student_id, semester_id, parameter)
);

CREATE INDEX IF NOT EXISTS idx_scores_student_semester
  ON scores(student_id, semester_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scores_insert" ON scores FOR INSERT WITH CHECK (true);
CREATE POLICY "scores_select" ON scores FOR SELECT USING (true);
CREATE POLICY "scores_update" ON scores FOR UPDATE USING (true) WITH CHECK (true);
