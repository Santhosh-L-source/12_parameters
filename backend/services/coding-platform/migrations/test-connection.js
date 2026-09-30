/**
 * Test Supabase connection
 * Run this before migrating to verify your credentials work
 *
 * Usage: node migrations/test-connection.js
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

async function testConnection() {
  console.log('🔌 Testing Supabase connection...\n');

  // Check if credentials are set
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    console.error('❌ ERROR: No database credentials found!');
    console.error('\n📝 Please update your .env file with Supabase credentials:');
    console.error('   DATABASE_URL=postgresql://postgres:password@your-project.supabase.co:5432/postgres');
    console.error('   OR');
    console.error('   DB_DIALECT=postgres');
    console.error('   DB_HOST=your-project.supabase.co');
    console.error('   DB_PASSWORD=your-password');
    process.exit(1);
  }

  // Connect to PostgreSQL/Supabase
  const db = new Sequelize(process.env.DATABASE_URL || {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  });

  try {
    // Test authentication
    await db.authenticate();
    console.log('✅ Successfully connected to Supabase!\n');

    // Test query
    const [results] = await db.query('SELECT version()');
    console.log('📊 PostgreSQL version:', results[0].version);

    // Check if tables exist
    console.log('\n🔍 Checking for tables...');
    const [tables] = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('students', 'coding_evidence', 'verification_attempts')
      ORDER BY table_name
    `);

    if (tables.length === 0) {
      console.log('⚠️  No tables found. You need to run the schema SQL first!');
      console.log('   1. Open Supabase Dashboard → SQL Editor');
      console.log('   2. Run migrations/001_initial_schema.sql');
    } else {
      console.log(`✅ Found ${tables.length} table(s):`);
      tables.forEach(t => console.log(`   - ${t.table_name}`));
    }

    console.log('\n🎉 Connection test successful!');
    console.log('\n📝 Next steps:');
    if (tables.length === 0) {
      console.log('   1. Run the schema SQL in Supabase SQL Editor');
      console.log('   2. Run: node migrations/migrate-to-supabase.js');
    } else {
      console.log('   1. Run: node migrations/migrate-to-supabase.js');
    }
    console.log('   2. Restart your application\n');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check your Supabase credentials in .env');
    console.error('   2. Verify your Supabase project is running');
    console.error('   3. Check if your IP is allowed (Supabase allows all by default)');
    console.error('   4. Try using the connection string instead of individual params\n');
    process.exit(1);
  } finally {
    await db.close();
  }
}

testConnection();
