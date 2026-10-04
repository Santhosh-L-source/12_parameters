const sequelize = require('./database');

const ROLL_MAPPINGS = {
  '312425106015': '25EC1332',      // AISHWARYA .B.D (old: '1332')
  '312425205086': '25IT1120',      // jerpsh rishal A (old: '20IT1120')
  '312425104183': '25CS1229',      // Premnath S (old: '225CS1229')
  '312325243008': '25AD378',       // Abu Huraira J (old: '23AD378')
  '312425106032': '25EC1333',      // Avinash P (old: '23EC1333')
  '312425106182': '25EC1371',      // Suthiksha SL (old: '23EC1371')
  '312425205029': '25IT1137',      // Bharathi S S (old: '23IT1137')
  '312325205062': '25IT352',       // Harini G (old: '23IT352')
  '312325104193': '25CS204',       // mythly (old: '24CS204')
  '312425106128': '25EC1977',      // Pabitha M (old: '24EC1977')
  '312325205164': '25IT241',       // Prisha.D (old: '24IT241')
  '312325205236': '25IT403',       // Surendhar M (old: '265IT403')
  '312425104163': '25CS1124',      // Niveditha Nagappan (old: '2CS1124')
  '312325205255': '25IT255',       // yoganand S R (old: '31232505255')
  '312325104088': '25CS1088',      // Gayathri priya M.R
  '312325106046': '25EC1046',      // Diwakar B
  '312325106111': '25EC1111',      // MOHAMED RASHIDH U
  '312325106116': '25EC1116',      // MUVIN B
  '312325106149': '25EC1149',      // Sachin M
  '312325106168': '25EC1168',      // Shalom Charles V
  '312325106177': '25EC1177',      // ꜱɪᴇɢᴇɴ ᴘᴀᴜʟ
  '312325114013': '25ME1013',      // Balaji . S
  '312325149003': '25CY1003',      // Alwin Bristal
  '312325205065': '25IT1065',      // Hemal B M
  '312325247093': '25AM1093',      // RITHINKUMAR J
  '312425104070': '25CS1070',      // Hailey M
  '312425104074': '25CS1074',      // Haresh.P
  '312425106149': '25EC1149B',     // Ram Vasiharan S
  '312425148005': '25AM1005',      // Akshaya Lakshmi
  '312425243005': '25AD1005',      // ABINESH.M
  '312325205221': '25IT180',       // Smrithi Angelin (old: 'E25IT180')
  '312325104023': '25CS1023',      // Antonio (old: 'Juha')
};

async function fix2029RollNumbers() {
  try {
    console.log('--- Starting 2029 Batch Roll Number Normalization (Direct Mode) ---');

    // 1. Get all public tables that have student_id column
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND column_name = 'student_id'
    `);
    const validStudentIdTables = tables.map(t => t.table_name);
    console.log(`Found ${validStudentIdTables.length} tables with student_id column.`);

    for (const [reg, newRoll] of Object.entries(ROLL_MAPPINGS)) {
      const [rows] = await sequelize.query(
        `SELECT id_number, register_number, name FROM profiles WHERE register_number = :reg`,
        { replacements: { reg } }
      );

      if (rows.length === 0) {
        console.warn(`Profile not found for register number: ${reg}`);
        continue;
      }

      const oldRoll = rows[0].id_number;
      console.log(`Updating [${rows[0].name}]: ${oldRoll} -> ${newRoll} (Reg: ${reg})`);

      // Update student_id in all verified tables
      for (const table of validStudentIdTables) {
        await sequelize.query(
          `UPDATE ${table} SET student_id = :newRoll WHERE student_id = :oldRoll`,
          { replacements: { newRoll, oldRoll } }
        );
      }

      // Update profiles id_number
      await sequelize.query(
        `UPDATE profiles SET id_number = :newRoll WHERE register_number = :reg`,
        { replacements: { newRoll, reg } }
      );
    }

    // Uppercase all 2nd year roll numbers
    await sequelize.query(`
      UPDATE profiles 
      SET id_number = UPPER(id_number) 
      WHERE (register_number LIKE '312325%' OR register_number LIKE '312425%')
        AND role = 'student';
    `);

    console.log('✅ All profiles & related table roll numbers updated.');

    // 2. Re-run mentor assignment to ensure everyone is assigned properly
    console.log('Re-syncing mentor assignments for 2nd and 3rd year...');
    const seedYearMentors = require('./seedYearMentors');
    if (typeof seedYearMentors === 'function') {
      await seedYearMentors();
    }

    console.log('🎉 Done! All 2029 batch roll numbers normalized to start with 25.');

  } catch (err) {
    console.error('❌ Error fixing roll numbers:', err);
  } finally {
    await sequelize.close();
  }
}

fix2029RollNumbers();
