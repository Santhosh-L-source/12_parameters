const sequelize = require('./database');

async function patchTables() {
  try {
    console.log('🛠️ Adding distinct_key and all required evidence table columns...');

    // 1. monthly_coding_evidence
    await sequelize.query(`
      ALTER TABLE monthly_coding_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS semester INTEGER,
        ADD COLUMN IF NOT EXISTS month TEXT,
        ADD COLUMN IF NOT EXISTS year INTEGER,
        ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS problems_solved INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_problems INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS platform TEXT,
        ADD COLUMN IF NOT EXISTS proof_url TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 2. hundred_days_evidence
    await sequelize.query(`
      ALTER TABLE hundred_days_evidence
        ADD COLUMN IF NOT EXISTS training_program TEXT,
        ADD COLUMN IF NOT EXISTS selection_year INTEGER,
        ADD COLUMN IF NOT EXISTS selection_letter_url TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 3. language_evidence
    await sequelize.query(`
      ALTER TABLE language_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS proficiency_level TEXT,
        ADD COLUMN IF NOT EXISTS certification_name TEXT,
        ADD COLUMN IF NOT EXISTS certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 4. gate_exam_evidence
    await sequelize.query(`
      ALTER TABLE gate_exam_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS exam_year INTEGER,
        ADD COLUMN IF NOT EXISTS registration_number TEXT,
        ADD COLUMN IF NOT EXISTS marks_obtained NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS score_range TEXT,
        ADD COLUMN IF NOT EXISTS admit_card_url TEXT,
        ADD COLUMN IF NOT EXISTS scorecard_url TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 5. competition_evidence
    await sequelize.query(`
      ALTER TABLE competition_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS competition_name TEXT,
        ADD COLUMN IF NOT EXISTS event_level TEXT,
        ADD COLUMN IF NOT EXISTS prize_category TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 6. internship_evidence
    await sequelize.query(`
      ALTER TABLE internship_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS internship_type TEXT,
        ADD COLUMN IF NOT EXISTS duration_weeks INTEGER,
        ADD COLUMN IF NOT EXISTS stipend_amount NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS completion_certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 7. certificate_evidence
    await sequelize.query(`
      ALTER TABLE certificate_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS issuing_organization TEXT,
        ADD COLUMN IF NOT EXISTS certificate_type TEXT,
        ADD COLUMN IF NOT EXISTS credential_id TEXT,
        ADD COLUMN IF NOT EXISTS credential_url TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 8. aptitude_communication_evidence
    await sequelize.query(`
      ALTER TABLE aptitude_communication_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS assessment_type TEXT,
        ADD COLUMN IF NOT EXISTS test_name TEXT,
        ADD COLUMN IF NOT EXISTS score_percentage NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 9. coding_problems_evidence
    await sequelize.query(`
      ALTER TABLE coding_problems_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 10. cp_rating_evidence
    await sequelize.query(`
      ALTER TABLE cp_rating_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS max_rating INTEGER,
        ADD COLUMN IF NOT EXISTS profile_url TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 11. open_source_evidence
    await sequelize.query(`
      ALTER TABLE open_source_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS repository_name TEXT,
        ADD COLUMN IF NOT EXISTS pr_url TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 12. project_evidence
    await sequelize.query(`
      ALTER TABLE project_evidence
        ADD COLUMN IF NOT EXISTS distinct_key TEXT,
        ADD COLUMN IF NOT EXISTS project_type TEXT,
        ADD COLUMN IF NOT EXISTS paper_doi TEXT,
        ADD COLUMN IF NOT EXISTS patent_app_num TEXT,
        ADD COLUMN IF NOT EXISTS mentor_id TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT 'MENTOR_MANUAL',
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    console.log('✅ All evidence tables successfully patched with distinct_key and module columns!');
  } catch (err) {
    console.error('❌ Error patching tables:', err);
  } finally {
    await sequelize.close();
  }
}

patchTables();
