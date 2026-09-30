const sequelize = require('../src/config/database');

async function removeGeneralMentors() {
  try {
    console.log('Removing General mentors...');

    // 1. Unassign any student assigned to MENTOR_GENERAL or any General department mentor
    await sequelize.query(`
      UPDATE profiles 
      SET assigned_mentor_id = NULL 
      WHERE assigned_mentor_id = 'MENTOR_GENERAL'
         OR assigned_mentor_id IN (
           SELECT id_number FROM profiles WHERE role = 'mentor' AND (UPPER(department) = 'GENERAL' OR department IS NULL)
         )
    `);

    // 2. Delete MENTOR_GENERAL, MENTOR_1, MENTOR_2 and any mentor with department 'General' / NULL
    await sequelize.query(`
      DELETE FROM profiles 
      WHERE role = 'mentor' 
        AND (
          id_number IN ('MENTOR_GENERAL', 'MENTOR_1', 'MENTOR_2') 
          OR UPPER(TRIM(department)) = 'GENERAL' 
          OR department IS NULL
        )
    `);

    // 3. Query remaining mentors
    const remaining = await sequelize.query(`
      SELECT 
        m.id_number,
        m.name,
        m.department,
        COUNT(s.id_number) as assigned_students
      FROM profiles m
      LEFT JOIN profiles s ON s.assigned_mentor_id = m.id_number AND s.role = 'student'
      WHERE m.role = 'mentor'
      GROUP BY m.id_number, m.name, m.department
      ORDER BY m.department ASC
    `, { type: sequelize.QueryTypes.SELECT });

    console.log('\n=== REMAINING ACTIVE DEPARTMENT MENTORS ===');
    console.table(remaining);

    console.log('\nDept General mentors removed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error removing general mentors:', err);
    process.exit(1);
  }
}

removeGeneralMentors();
