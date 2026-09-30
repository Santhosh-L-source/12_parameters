const sequelize = require('./src/config/database');

async function migrate() {
  try {
    console.log('Starting schema migration for Competition module...');

    // Add new columns
    const newColumns = [
      { name: 'stage', type: 'VARCHAR(50)' },
      { name: 'level', type: 'VARCHAR(50)' },
      { name: 'website_verified', type: 'BOOLEAN DEFAULT false' },
      { name: 'mentor_verified', type: 'BOOLEAN DEFAULT false' },
      { name: 'website_verified_at', type: 'TIMESTAMP' },
    ];

    for (const col of newColumns) {
      try {
        await sequelize.query(`
          ALTER TABLE competition_evidence
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
