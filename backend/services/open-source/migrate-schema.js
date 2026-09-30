const sequelize = require('./src/config/database');

async function migrate() {
  try {
    console.log('Starting schema migration for Open Source module...');

    // Add new columns
    const newColumns = [
      { name: 'merged', type: 'BOOLEAN DEFAULT false' },
      { name: 'valid_prs_count', type: 'INTEGER DEFAULT 0' },
      { name: 'merged_prs_count', type: 'INTEGER DEFAULT 0' },
      { name: 'platform', type: 'VARCHAR(20)' },
    ];

    for (const col of newColumns) {
      try {
        await sequelize.query(`
          ALTER TABLE opensource_evidence
          ADD COLUMN ${col.name} ${col.type};
        `);
        console.log(`✓ Added ${col.name} column`);
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate column')) {
          console.log(`  ${col.name} column already exists (ok)`);
        } else {
          console.error(`Error adding ${col.name}:`, err.message);
        }
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
