/**
 * Migration script to move data from SQLite to Supabase (PostgreSQL)
 *
 * Usage:
 * 1. Set up your Supabase project
 * 2. Run the schema SQL (001_initial_schema.sql) in Supabase SQL Editor
 * 3. Update .env with Supabase credentials
 * 4. Run: node migrations/migrate-to-supabase.js
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const SQLITE_PATH = './hope_evidence.sqlite';

async function migrate() {
  console.log('🚀 Starting migration from SQLite to Supabase...\n');

  // Connect to SQLite (source)
  console.log('📂 Connecting to SQLite database...');
  const sqliteDb = new Sequelize({
    dialect: 'sqlite',
    storage: SQLITE_PATH,
    logging: false,
  });

  // Connect to PostgreSQL/Supabase (destination)
  console.log('🐘 Connecting to Supabase (PostgreSQL)...');
  const postgresDb = new Sequelize(process.env.DATABASE_URL || {
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
    // Test connections
    await sqliteDb.authenticate();
    console.log('✅ Connected to SQLite\n');

    await postgresDb.authenticate();
    console.log('✅ Connected to Supabase\n');

    // Migrate Students
    console.log('👤 Migrating students...');
    const [students] = await sqliteDb.query('SELECT * FROM students');
    console.log(`   Found ${students.length} students`);

    for (const student of students) {
      await postgresDb.query(
        `INSERT INTO students (id, roll_number, name, email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (roll_number) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           updated_at = EXCLUDED.updated_at`,
        {
          bind: [
            student.id,
            student.roll_number,
            student.name,
            student.email,
            student.password_hash,
            student.created_at,
            student.updated_at,
          ],
        }
      );
    }
    console.log('✅ Students migrated\n');

    // Migrate Coding Evidence
    console.log('📊 Migrating coding evidence...');
    const [evidence] = await sqliteDb.query('SELECT * FROM coding_evidence');
    console.log(`   Found ${evidence.length} evidence records`);

    for (const ev of evidence) {
      await postgresDb.query(
        `INSERT INTO coding_evidence
         (id, student_id, semester, platform, profile_url, total_problems_solved,
          sql_problems_solved, status, fetched_at, mentor_id, verified_at, verified,
          external_username, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (student_id, platform) DO UPDATE SET
           semester = EXCLUDED.semester,
           profile_url = EXCLUDED.profile_url,
           total_problems_solved = EXCLUDED.total_problems_solved,
           sql_problems_solved = EXCLUDED.sql_problems_solved,
           status = EXCLUDED.status,
           fetched_at = EXCLUDED.fetched_at,
           mentor_id = EXCLUDED.mentor_id,
           verified_at = EXCLUDED.verified_at,
           verified = EXCLUDED.verified,
           external_username = EXCLUDED.external_username,
           updated_at = EXCLUDED.updated_at`,
        {
          bind: [
            ev.id,
            ev.student_id,
            ev.semester,
            ev.platform,
            ev.profile_url,
            ev.total_problems_solved,
            ev.sql_problems_solved,
            ev.status,
            ev.fetched_at,
            ev.mentor_id,
            ev.verified_at,
            ev.verified || false,
            ev.external_username,
            ev.created_at,
            ev.updated_at,
          ],
        }
      );
    }
    console.log('✅ Coding evidence migrated\n');

    // Migrate Verification Attempts
    console.log('🔐 Migrating verification attempts...');
    const [attempts] = await sqliteDb.query('SELECT * FROM verification_attempts');
    console.log(`   Found ${attempts.length} verification attempts`);

    for (const attempt of attempts) {
      await postgresDb.query(
        `INSERT INTO verification_attempts
         (id, student_id, platform, profile_url, external_username, token_hash,
          expires_at, status, verified_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT DO NOTHING`,
        {
          bind: [
            attempt.id,
            attempt.student_id,
            attempt.platform,
            attempt.profile_url,
            attempt.external_username,
            attempt.token_hash,
            attempt.expires_at,
            attempt.status,
            attempt.verified_at,
            attempt.created_at,
            attempt.updated_at,
          ],
        }
      );
    }
    console.log('✅ Verification attempts migrated\n');

    // Update sequences to match the migrated data
    console.log('🔢 Updating PostgreSQL sequences...');

    if (students.length > 0) {
      const maxStudentId = Math.max(...students.map(s => s.id));
      await postgresDb.query(`SELECT setval('students_id_seq', ${maxStudentId}, true)`);
    }

    if (evidence.length > 0) {
      const maxEvidenceId = Math.max(...evidence.map(e => e.id));
      await postgresDb.query(`SELECT setval('coding_evidence_id_seq', ${maxEvidenceId}, true)`);
    }

    if (attempts.length > 0) {
      const maxAttemptId = Math.max(...attempts.map(a => a.id));
      await postgresDb.query(`SELECT setval('verification_attempts_id_seq', ${maxAttemptId}, true)`);
    }

    console.log('✅ Sequences updated\n');

    console.log('🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update .env file with DB_DIALECT=postgres');
    console.log('   2. Restart your application');
    console.log('   3. Test the application thoroughly');
    console.log('   4. Keep the SQLite backup until you verify everything works\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sqliteDb.close();
    await postgresDb.close();
  }
}

// Run migration
migrate();
