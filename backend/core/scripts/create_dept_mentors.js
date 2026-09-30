const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');

async function createDeptMentors() {
  try {
    console.log('Connecting to database...');

    const defaultPasswordHash = await bcrypt.hash('Mentor@123', 10);

    const mentorProfiles = [
      { id: 'MENTOR_CSE', code: 'CSE', name: 'Dr. S. Raman (CSE Mentor)', email: 'mentor.cse@bitsathy.ac.in', dept: 'CSE' },
      { id: 'MENTOR_IT', code: 'IT', name: 'Prof. V. Priya (IT Mentor)', email: 'mentor.it@bitsathy.ac.in', dept: 'IT' },
      { id: 'MENTOR_AIDS', code: 'AI & DS', name: 'Dr. Suresh V (AI & DS Mentor)', email: 'mentor.aids@bitsathy.ac.in', dept: 'AI & DS' },
      { id: 'MENTOR_ECE', code: 'ECE', name: 'Dr. K. Balaji (ECE Mentor)', email: 'mentor.ece@bitsathy.ac.in', dept: 'ECE' },
      { id: 'MENTOR_EEE', code: 'EEE', name: 'Prof. Priya Sundaram (EEE Mentor)', email: 'mentor.eee@bitsathy.ac.in', dept: 'EEE' },
      { id: 'MENTOR_AIML', code: 'AI & ML', name: 'Dr. Meera N (AI & ML Mentor)', email: 'mentor.aiml@bitsathy.ac.in', dept: 'AI & ML' },
      { id: 'MENTOR_CYBER', code: 'CSE (Cyber Security)', name: 'Dr. Vignesh Kumar (Cyber Security Mentor)', email: 'mentor.cyber@bitsathy.ac.in', dept: 'CSE (Cyber Security)' },
      { id: 'MENTOR_MECH', code: 'Mechanical', name: 'Dr. Senthil Nathan (Mechanical Mentor)', email: 'mentor.mech@bitsathy.ac.in', dept: 'Mechanical' },
      { id: 'MENTOR_BIOTECH', code: 'Biotechnology', name: 'Dr. Kavitha Raman (Biotech Mentor)', email: 'mentor.biotech@bitsathy.ac.in', dept: 'Biotechnology' },
      { id: 'MENTOR_CHEM', code: 'Chemical', name: 'Dr. Arvind Swamy (Chemical Mentor)', email: 'mentor.chem@bitsathy.ac.in', dept: 'Chemical' },
      { id: 'MENTOR_MECHATRONICS', code: 'Mechatronics', name: 'Prof. Ramesh K (Mechatronics Mentor)', email: 'mentor.mechatronics@bitsathy.ac.in', dept: 'Mechatronics' },
      { id: 'MENTOR_GENERAL', code: 'GENERAL', name: 'Prof. General Academic Advisor', email: 'mentor.general@bitsathy.ac.in', dept: 'General' },
    ];

    for (const m of mentorProfiles) {
      await sequelize.query(`
        INSERT INTO profiles (
          id_number, register_number, name, email, password_hash, role, department, college, created_at, updated_at
        ) VALUES (
          :id, :id, :name, :email, :password_hash, 'mentor', :dept, 'Bannari Amman Institute of Technology', NOW(), NOW()
        )
        ON CONFLICT (id_number) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          department = EXCLUDED.department,
          role = 'mentor',
          password_hash = EXCLUDED.password_hash
      `, {
        replacements: {
          id: m.id,
          name: m.name,
          email: m.email,
          password_hash: defaultPasswordHash,
          dept: m.dept
        }
      });

      // Assign students of this department to this mentor
      await sequelize.query(`
        UPDATE profiles
        SET assigned_mentor_id = :mentorId,
            updated_at = NOW()
        WHERE role = 'student' 
          AND (
            UPPER(TRIM(department)) = UPPER(TRIM(:deptCode))
            OR (department IS NULL AND :deptCode = 'GENERAL')
            OR (:deptCode = 'Mechanical' AND UPPER(department) LIKE '%MECH%')
            OR (:deptCode = 'Biotechnology' AND UPPER(department) LIKE '%BIO%')
            OR (:deptCode = 'Chemical' AND UPPER(department) LIKE '%CHEM%')
          )
      `, {
        replacements: {
          mentorId: m.id,
          deptCode: m.code
        }
      });
    }

    // Clean up any old unused temp mentors without students
    await sequelize.query(`
      DELETE FROM profiles 
      WHERE id_number IN ('MENTOR_AI___DS', 'MENTOR_AI___ML', 'MENTOR_CSE__CYBER_SECURITY_', 'MENTOR_MECHANICAL', 'MENTOR_BIOTECHNOLOGY', 'MENTOR_CHEMICAL')
    `);

    // Summary
    const summary = await sequelize.query(`
      SELECT 
        m.id_number,
        m.name,
        m.department,
        COUNT(s.id_number) as student_count
      FROM profiles m
      LEFT JOIN profiles s ON s.assigned_mentor_id = m.id_number AND s.role = 'student'
      WHERE m.role = 'mentor'
      GROUP BY m.id_number, m.name, m.department
      ORDER BY student_count DESC, m.department ASC
    `, { type: sequelize.QueryTypes.SELECT });

    console.log('\n=== MENTOR COHORTS SUMMARY ===');
    console.table(summary);

    console.log('\nAll department mentors created with default password "Mentor@123" and students mapped!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating department mentors:', error);
    process.exit(1);
  }
}

createDeptMentors();
