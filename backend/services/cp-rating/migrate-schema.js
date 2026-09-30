const sequelize = require('./src/config/database');

async function migrate() {
  try {
    console.log('Starting schema migration...');

    // Add fetched_at column if it doesn't exist
    await sequelize.query(`
      ALTER TABLE cp_rating_evidence
      ADD COLUMN fetched_at DATETIME;
    `).catch(err => {
      if (err.message.includes('duplicate column')) {
        console.log('✓ fetched_at column already exists');
      } else {
        throw err;
      }
    });

    console.log('✓ Added fetched_at column');

    // Try to drop old columns (may fail if they don't exist, that's ok)
    const columnsToDrop = ['status', 'mentor_id', 'verified_at'];
    for (const col of columnsToDrop) {
      try {
        await sequelize.query(`ALTER TABLE cp_rating_evidence DROP COLUMN ${col};`);
        console.log(`✓ Removed ${col} column`);
      } catch (err) {
        console.log(`  ${col} column doesn't exist (ok)`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
