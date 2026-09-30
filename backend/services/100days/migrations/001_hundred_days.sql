-- Hundred Days Training Programme tables
-- Assumes a `students` table exists with columns: id, register_number, name

CREATE TYPE hd_batch_type AS ENUM ('PEP', 'HOPE_NON_ELITE', 'HOPE_ELITE');
CREATE TYPE hd_list_status AS ENUM ('PENDING', 'APPROVED', 'SUPERSEDED', 'REJECTED');
CREATE TYPE hd_match_status AS ENUM ('MATCHED', 'UNMATCHED', 'NAME_CONFLICT');

-- One row per uploaded official file
CREATE TABLE hundred_days_lists (
  id                SERIAL PRIMARY KEY,
  batch_type        hd_batch_type NOT NULL,
  file_name         TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  publication_date  DATE NOT NULL,
  uploaded_by       INTEGER NOT NULL,     -- FK to your users/staff table
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            hd_list_status NOT NULL DEFAULT 'PENDING',
  version_number    INTEGER NOT NULL DEFAULT 1,
  notes             TEXT
);

-- One row per student record inside an uploaded file
CREATE TABLE hundred_days_entries (
  id                  SERIAL PRIMARY KEY,
  list_id             INTEGER NOT NULL REFERENCES hundred_days_lists(id),
  register_number     TEXT NOT NULL,        -- normalized (trimmed, uppercased)
  name_in_file        TEXT NOT NULL,        -- normalized (trimmed)
  matched_student_id  INTEGER,              -- FK to students.id, nullable until matched
  match_status        hd_match_status NOT NULL DEFAULT 'UNMATCHED',
  raw_register_number TEXT NOT NULL,        -- original from file
  raw_name            TEXT NOT NULL         -- original from file
);

-- One row per student, upserted on every approved import
CREATE TABLE hundred_days_scores (
  id                        SERIAL PRIMARY KEY,
  student_id                INTEGER NOT NULL UNIQUE,  -- FK to students.id
  register_number           TEXT NOT NULL,
  student_name              TEXT NOT NULL,
  in_pep                    BOOLEAN NOT NULL DEFAULT FALSE,
  in_hope_non_elite         BOOLEAN NOT NULL DEFAULT FALSE,
  in_hope_elite             BOOLEAN NOT NULL DEFAULT FALSE,
  awarded_mark              SMALLINT NOT NULL DEFAULT 0,
  awarded_category          TEXT NOT NULL DEFAULT 'Not selected',
  source_list_ids           INTEGER[] NOT NULL DEFAULT '{}',
  last_calculated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_list_publication_date DATE
);

-- Append-only audit log — no UPDATE or DELETE allowed on this table
CREATE TABLE hundred_days_audit_log (
  id                    SERIAL PRIMARY KEY,
  event_type            TEXT NOT NULL,
  student_id            INTEGER NOT NULL,
  register_number       TEXT NOT NULL,
  previous_mark         SMALLINT,
  new_mark              SMALLINT NOT NULL,
  previous_category     TEXT,
  new_category          TEXT NOT NULL,
  triggered_by_list_id  INTEGER REFERENCES hundred_days_lists(id),
  triggered_by_user_id  INTEGER NOT NULL,
  event_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                 TEXT
);

-- Prevent any UPDATE or DELETE on the audit log
CREATE RULE audit_log_no_update AS ON UPDATE TO hundred_days_audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO hundred_days_audit_log DO INSTEAD NOTHING;

-- Indexes
CREATE INDEX idx_hd_entries_list_id     ON hundred_days_entries(list_id);
CREATE INDEX idx_hd_entries_reg_num     ON hundred_days_entries(register_number);
CREATE INDEX idx_hd_entries_student_id  ON hundred_days_entries(matched_student_id);
CREATE INDEX idx_hd_scores_student_id   ON hundred_days_scores(student_id);
CREATE INDEX idx_hd_audit_student_id    ON hundred_days_audit_log(student_id);
CREATE INDEX idx_hd_lists_batch_status  ON hundred_days_lists(batch_type, status);
