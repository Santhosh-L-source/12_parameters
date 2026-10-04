const sequelize = require('./database');

async function fixConstraints() {
  try {
    console.log('🛠️ Making academic_year nullable in scores table...');

    await sequelize.query(`
      ALTER TABLE scores 
        ALTER COLUMN academic_year DROP NOT NULL,
        ALTER COLUMN academic_year SET DEFAULT 2026;
    `);

    console.log('✅ Successfully removed NOT NULL constraint from academic_year in scores table!');
  } catch (err) {
    console.error('❌ Error updating scores table:', err);
  } finally {
    await sequelize.close();
  }
}

fixConstraints();
