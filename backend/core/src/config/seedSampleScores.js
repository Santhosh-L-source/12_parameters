const sequelize = require('./database');

async function seedSampleScores() {
  try {
    console.log('--- Batch Seeding Sample Scores across 12 parameters ---');

    const [students] = await sequelize.query(`
      SELECT id_number, register_number, name, department 
      FROM profiles 
      WHERE role = 'student' 
      ORDER BY id_number ASC 
      LIMIT 40
    `);

    if (!students || students.length === 0) {
      console.log('No students found');
      return;
    }

    const parameters = [
      { id: 'hundred_days', max: 15 },
      { id: 'language', max: 15 },
      { id: 'gate', max: 25 },
      { id: 'competition', max: 20 },
      { id: 'internship', max: 20 },
      { id: 'certificate', max: 20 },
      { id: 'aptitude', max: 20 },
      { id: 'coding_problems', max: 25 },
      { id: 'cp_rating', max: 20 },
      { id: 'opensource', max: 20 },
      { id: 'monthly_coding', max: 20 },
      { id: 'project', max: 30 }
    ];

    const valueRows = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      let tierFactor;
      if (i < 4) tierFactor = 0.88;       // ~220/250 -> Elite Tier
      else if (i < 12) tierFactor = 0.72;  // ~180/250 -> Level 3
      else if (i < 26) tierFactor = 0.56;  // ~140/250 -> Level 2
      else if (i < 34) tierFactor = 0.40;  // ~100/250 -> Level 1
      else tierFactor = 0.20;              // ~50/250  -> Not Eligible

      for (const p of parameters) {
        const jitter = ((i * 7 + p.max) % 5) / 10 - 0.2;
        const ratio = Math.max(0, Math.min(1, tierFactor + jitter));
        const marks = Math.round(p.max * ratio * 10) / 10;
        valueRows.push(`('${s.id_number.replace(/'/g, "''")}', '${p.id}', ${marks}, 4, 'v2.1', false, NOW())`);
      }
    }

    if (valueRows.length > 0) {
      const batchSql = `
        INSERT INTO scores (register_number, parameter, marks, semester, rule_version, provisional, calculated_at)
        VALUES ${valueRows.join(',\n')}
        ON CONFLICT (register_number, parameter, semester) DO UPDATE
        SET marks = EXCLUDED.marks,
            rule_version = EXCLUDED.rule_version,
            calculated_at = NOW();
      `;
      await sequelize.query(batchSql);
    }

    console.log(`✅ Successfully batch seeded ${valueRows.length} scores for ${students.length} students!`);
  } catch (err) {
    console.error('Error in batch seeding scores:', err);
  } finally {
    await sequelize.close();
  }
}

seedSampleScores();
