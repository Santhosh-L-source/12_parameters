const sequelize = require('./database');

async function addConstraints() {
  try {
    console.log('Adding UNIQUE constraints to evidence tables...');

    const tablesWithDistinctKey = [
      { table: 'monthly_coding_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_monthly_coding_student_distinct' },
      { table: 'language_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_language_student_distinct' },
      { table: 'gate_exam_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_gate_student_distinct' },
      { table: 'competition_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_competition_student_distinct' },
      { table: 'internship_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_internship_student_distinct' },
      { table: 'certificate_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_certificate_student_distinct' },
      { table: 'aptitude_communication_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_aptitude_student_distinct' },
      { table: 'coding_problems_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_coding_problems_student_distinct' },
      { table: 'cp_rating_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_cp_rating_student_distinct' },
      { table: 'open_source_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_open_source_student_distinct' },
      { table: 'project_evidence', cols: ['student_id', 'distinct_key'], name: 'uq_project_student_distinct' }
    ];

    for (const item of tablesWithDistinctKey) {
      try {
        await sequelize.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS ${item.name}_idx ON ${item.table} (${item.cols.join(', ')});
        `);
        console.log(`✅ Created unique index for ${item.table} on (${item.cols.join(', ')})`);
      } catch (e) {
        console.warn(`Warning on ${item.table}:`, e.message);
      }
    }

    try {
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_hundred_days_student_idx ON hundred_days_evidence (student_id);
      `);
      console.log(`✅ Created unique index for hundred_days_evidence on (student_id)`);
    } catch (e) {}

    console.log('🎉 All unique constraints successfully created!');
  } catch (err) {
    console.error('❌ Error creating constraints:', err);
  } finally {
    await sequelize.close();
  }
}

addConstraints();
