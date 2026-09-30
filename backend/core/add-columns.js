// Add missing columns to students table
const sequelize = require('./src/config/database');

async function addColumns() {
  try {
    console.log('Adding missing columns to students table...');

    await sequelize.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS register_number TEXT');
    console.log('✅ Added register_number column');

    await sequelize.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS password TEXT');
    console.log('✅ Added password column');

    await sequelize.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS department TEXT');
    console.log('✅ Added department column');

    await sequelize.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS college TEXT');
    console.log('✅ Added college column');

    console.log('\n✅ All columns added successfully!');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

addColumns();
