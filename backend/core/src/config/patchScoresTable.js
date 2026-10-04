const sequelize = require('./database');

async function patchScores() {
  try {
    console.log('🛠️ Patching scores table with canonical columns...');

    await sequelize.query(`
      ALTER TABLE scores
        ADD COLUMN IF NOT EXISTS parameter TEXT,
        ADD COLUMN IF NOT EXISTS marks NUMERIC(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS semester INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS provisional BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS rule_version TEXT,
        ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // Create unique index for (register_number, semester, parameter)
    try {
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_scores_reg_sem_param_idx 
        ON scores (register_number, semester, parameter);
      `);
      console.log('✅ Created unique index for scores (register_number, semester, parameter)');
    } catch (e) {
      console.warn('Index notice:', e.message);
    }

    console.log('🎉 scores table successfully patched!');
  } catch (err) {
    console.error('❌ Error patching scores table:', err);
  } finally {
    await sequelize.close();
  }
}

patchScores();
