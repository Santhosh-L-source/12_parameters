const sequelize = require('../src/config/database');

async function assignAllUnassigned() {
  try {
    console.log('Checking for unassigned students...');

    const unassigned = await sequelize.query(`
      SELECT id_number, name, department, assigned_mentor_id 
      FROM profiles 
      WHERE role = 'student' 
        AND (
          assigned_mentor_id IS NULL 
          OR assigned_mentor_id = '' 
          OR assigned_mentor_id NOT IN (SELECT id_number FROM profiles WHERE role = 'mentor')
        )
    `, { type: sequelize.QueryTypes.SELECT });

    console.log(`Found ${unassigned.length} unassigned student(s).`);

    const mentors = await sequelize.query(`
      SELECT id_number, department FROM profiles WHERE role = 'mentor'
    `, { type: sequelize.QueryTypes.SELECT });

    for (const st of unassigned) {
      let targetMentor = null;
      const deptUpper = (st.department || '').toUpperCase().trim();

      if (deptUpper) {
        const match = mentors.find(m => {
          const mDept = (m.department || '').toUpperCase().trim();
          return mDept === deptUpper || deptUpper.includes(mDept) || mDept.includes(deptUpper);
        });
        if (match) targetMentor = match.id_number;
      }

      if (!targetMentor) {
        // Fallback to CSE mentor
        targetMentor = 'MENTOR_CSE';
      }

      await sequelize.query(`
        UPDATE profiles 
        SET assigned_mentor_id = :mentorId,
            updated_at = NOW()
        WHERE id_number = :id
      `, {
        replacements: { mentorId: targetMentor, id: st.id_number }
      });

      console.log(`Mapped student ${st.id_number} (${st.name} - ${st.department || 'No Dept'}) -> ${targetMentor}`);
    }

    const unassignedCheck = await sequelize.query(`
      SELECT COUNT(id_number) as count 
      FROM profiles 
      WHERE role = 'student' 
        AND (
          assigned_mentor_id IS NULL 
          OR assigned_mentor_id = '' 
          OR assigned_mentor_id NOT IN (SELECT id_number FROM profiles WHERE role = 'mentor')
        )
    `, { type: sequelize.QueryTypes.SELECT });

    console.log('Unassigned remaining:', unassignedCheck[0].count);

    // Summary of mentors
    const summary = await sequelize.query(`
      SELECT 
        m.id_number,
        m.name,
        m.department,
        COUNT(s.id_number) as mentees
      FROM profiles m
      LEFT JOIN profiles s ON s.assigned_mentor_id = m.id_number AND s.role = 'student'
      WHERE m.role = 'mentor'
      GROUP BY m.id_number, m.name, m.department
      ORDER BY m.department ASC
    `, { type: sequelize.QueryTypes.SELECT });

    console.table(summary);
    process.exit(0);
  } catch (err) {
    console.error('Error assigning students:', err);
    process.exit(1);
  }
}

assignAllUnassigned();
