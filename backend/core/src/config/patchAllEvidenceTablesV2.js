const sequelize = require('./database');

async function patchAllTables() {
  try {
    console.log('🛠️ Adding all missing columns to evidence tables...');

    // 1. coding_problems_evidence
    await sequelize.query(`
      ALTER TABLE coding_problems_evidence
        ADD COLUMN IF NOT EXISTS platform TEXT,
        ADD COLUMN IF NOT EXISTS username TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS total_solved INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sql_solved INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS fetch_method TEXT DEFAULT 'MANUAL',
        ADD COLUMN IF NOT EXISTS fetch_status TEXT,
        ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS profile_url TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      -- Add distinct_key_normalized generated column if not exists
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'coding_problems_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE coding_problems_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    // 2. cp_rating_evidence
    await sequelize.query(`
      ALTER TABLE cp_rating_evidence
        ADD COLUMN IF NOT EXISTS platform TEXT,
        ADD COLUMN IF NOT EXISTS username TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS current_rating INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS max_rating INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS profile_url TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'cp_rating_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE cp_rating_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    // 3. open_source_evidence
    await sequelize.query(`
      ALTER TABLE open_source_evidence
        ADD COLUMN IF NOT EXISTS github_username TEXT,
        ADD COLUMN IF NOT EXISTS repository_name TEXT,
        ADD COLUMN IF NOT EXISTS pr_url TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS prs_merged INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'open_source_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE open_source_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    // 4. language_evidence
    await sequelize.query(`
      ALTER TABLE language_evidence
        ADD COLUMN IF NOT EXISTS language TEXT,
        ADD COLUMN IF NOT EXISTS proficiency_level TEXT,
        ADD COLUMN IF NOT EXISTS certification_name TEXT,
        ADD COLUMN IF NOT EXISTS certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'language_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE language_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    // 5. gate_exam_evidence
    await sequelize.query(`
      ALTER TABLE gate_exam_evidence
        ADD COLUMN IF NOT EXISTS exam_type TEXT,
        ADD COLUMN IF NOT EXISTS exam_year INTEGER,
        ADD COLUMN IF NOT EXISTS registration_number TEXT,
        ADD COLUMN IF NOT EXISTS tests_completed INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS full_length_tests INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS average_score_percent DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS diagnostic_completed BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS official_appearance BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS qualified BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS gate_score DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS branch_code TEXT,
        ADD COLUMN IF NOT EXISTS is_bonus_exam BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS scorecard_url TEXT,
        ADD COLUMN IF NOT EXISTS admit_card_url TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'gate_exam_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE gate_exam_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    // 6. certificate_evidence
    await sequelize.query(`
      ALTER TABLE certificate_evidence
        ADD COLUMN IF NOT EXISTS course_name TEXT,
        ADD COLUMN IF NOT EXISTS issuing_organization TEXT,
        ADD COLUMN IF NOT EXISTS certificate_type TEXT,
        ADD COLUMN IF NOT EXISTS credential_id TEXT,
        ADD COLUMN IF NOT EXISTS credential_url TEXT,
        ADD COLUMN IF NOT EXISTS certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'certificate_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE certificate_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    // 7. project_evidence
    await sequelize.query(`
      ALTER TABLE project_evidence
        ADD COLUMN IF NOT EXISTS project_title TEXT,
        ADD COLUMN IF NOT EXISTS project_type TEXT,
        ADD COLUMN IF NOT EXISTS repo_or_paper_url TEXT,
        ADD COLUMN IF NOT EXISTS repo_url TEXT,
        ADD COLUMN IF NOT EXISTS paper_doi TEXT,
        ADD COLUMN IF NOT EXISTS patent_app_num TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'project_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE project_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    // 8. competition_evidence
    await sequelize.query(`
      ALTER TABLE competition_evidence
        ADD COLUMN IF NOT EXISTS event_name TEXT,
        ADD COLUMN IF NOT EXISTS competition_name TEXT,
        ADD COLUMN IF NOT EXISTS event_level TEXT,
        ADD COLUMN IF NOT EXISTS rank_or_position TEXT,
        ADD COLUMN IF NOT EXISTS prize_category TEXT,
        ADD COLUMN IF NOT EXISTS certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'competition_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE competition_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    // 9. internship_evidence
    await sequelize.query(`
      ALTER TABLE internship_evidence
        ADD COLUMN IF NOT EXISTS company_name TEXT,
        ADD COLUMN IF NOT EXISTS domain TEXT,
        ADD COLUMN IF NOT EXISTS internship_type TEXT,
        ADD COLUMN IF NOT EXISTS duration_weeks INTEGER,
        ADD COLUMN IF NOT EXISTS stipend_amount NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS completion_certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS offer_letter_url TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'internship_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE internship_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    // 10. aptitude_communication_evidence
    await sequelize.query(`
      ALTER TABLE aptitude_communication_evidence
        ADD COLUMN IF NOT EXISTS test_type TEXT,
        ADD COLUMN IF NOT EXISTS assessment_type TEXT,
        ADD COLUMN IF NOT EXISTS test_name TEXT,
        ADD COLUMN IF NOT EXISTS score NUMERIC(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS score_percentage NUMERIC(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'aptitude_communication_evidence' AND column_name = 'distinct_key_normalized'
        ) THEN
          ALTER TABLE aptitude_communication_evidence 
          ADD COLUMN distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED;
        END IF;
      END $$;
    `);

    console.log('🎉 All evidence tables successfully patched with full column sets and normalized generated columns!');
  } catch (err) {
    console.error('❌ Error patching tables:', err);
  } finally {
    await sequelize.close();
  }
}

patchAllTables();
