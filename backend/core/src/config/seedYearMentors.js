const sequelize = require('./database');

async function seedYearMentors() {
  try {
    console.log('--- Seeding 3rd Year and 2nd Year Mentors ---');

    // 1. Ensure column exists
    await sequelize.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mentor_year INT;`);

    // 2. 3rd Year Mentors
    const thirdYearMentors = [
      { id: 'MENTOR_3RD_CSE', reg: 'MENTOR_REG_3RD_CSE', name: 'Dr. S. Raman (3rd Yr CSE)', email: 'mentor.3rd.cse@bitsathy.ac.in', dept: 'CSE', year: 3 },
      { id: 'MENTOR_3RD_IT', reg: 'MENTOR_REG_3RD_IT', name: 'Prof. V. Priya (3rd Yr IT)', email: 'mentor.3rd.it@bitsathy.ac.in', dept: 'IT', year: 3 },
      { id: 'MENTOR_3RD_AIDS', reg: 'MENTOR_REG_3RD_AIDS', name: 'Dr. Suresh V (3rd Yr AI & DS)', email: 'mentor.3rd.aids@bitsathy.ac.in', dept: 'AI & DS', year: 3 },
      { id: 'MENTOR_3RD_ECE', reg: 'MENTOR_REG_3RD_ECE', name: 'Dr. K. Balaji (3rd Yr ECE)', email: 'mentor.3rd.ece@bitsathy.ac.in', dept: 'ECE', year: 3 },
      { id: 'MENTOR_3RD_EEE', reg: 'MENTOR_REG_3RD_EEE', name: 'Prof. Priya Sundaram (3rd Yr EEE)', email: 'mentor.3rd.eee@bitsathy.ac.in', dept: 'EEE', year: 3 },
      { id: 'MENTOR_3RD_AIML', reg: 'MENTOR_REG_3RD_AIML', name: 'Dr. Meera N (3rd Yr AI & ML)', email: 'mentor.3rd.aiml@bitsathy.ac.in', dept: 'AI & ML', year: 3 },
      { id: 'MENTOR_3RD_CYBER', reg: 'MENTOR_REG_3RD_CYBER', name: 'Dr. Vignesh Kumar (3rd Yr Cyber Security)', email: 'mentor.3rd.cyber@bitsathy.ac.in', dept: 'CSE (Cyber Security)', year: 3 },
      { id: 'MENTOR_3RD_MECH', reg: 'MENTOR_REG_3RD_MECH', name: 'Dr. Senthil Nathan (3rd Yr Mechanical)', email: 'mentor.3rd.mech@bitsathy.ac.in', dept: 'Mechanical', year: 3 },
      { id: 'MENTOR_3RD_BIOTECH', reg: 'MENTOR_REG_3RD_BIOTECH', name: 'Dr. Kavitha Raman (3rd Yr Biotechnology)', email: 'mentor.3rd.biotech@bitsathy.ac.in', dept: 'Biotechnology', year: 3 },
      { id: 'MENTOR_3RD_CHEM', reg: 'MENTOR_REG_3RD_CHEM', name: 'Dr. Arvind Swamy (3rd Yr Chemical)', email: 'mentor.3rd.chem@bitsathy.ac.in', dept: 'Chemical', year: 3 },
      { id: 'MENTOR_3RD_MECHATRONICS', reg: 'MENTOR_REG_3RD_MECHATRONICS', name: 'Prof. Ramesh K (3rd Yr Mechatronics)', email: 'mentor.3rd.mechatronics@bitsathy.ac.in', dept: 'Mechatronics', year: 3 }
    ];

    // 3. 2nd Year Mentors
    const secondYearMentors = [
      { id: 'MENTOR_2ND_CSE', reg: 'MENTOR_REG_2ND_CSE', name: 'Dr. M. Karthikeyan (2nd Yr CSE)', email: 'mentor.2nd.cse@bitsathy.ac.in', dept: 'CSE', year: 2 },
      { id: 'MENTOR_2ND_IT', reg: 'MENTOR_REG_2ND_IT', name: 'Prof. R. Deepa (2nd Yr IT)', email: 'mentor.2nd.it@bitsathy.ac.in', dept: 'IT', year: 2 },
      { id: 'MENTOR_2ND_AIDS', reg: 'MENTOR_REG_2ND_AIDS', name: 'Dr. A. Gokulnath (2nd Yr AI & DS)', email: 'mentor.2nd.aids@bitsathy.ac.in', dept: 'AI & DS', year: 2 },
      { id: 'MENTOR_2ND_ECE', reg: 'MENTOR_REG_2ND_ECE', name: 'Dr. N. Soundararajan (2nd Yr ECE)', email: 'mentor.2nd.ece@bitsathy.ac.in', dept: 'ECE', year: 2 },
      { id: 'MENTOR_2ND_EEE', reg: 'MENTOR_REG_2ND_EEE', name: 'Prof. S. Manickam (2nd Yr EEE)', email: 'mentor.2nd.eee@bitsathy.ac.in', dept: 'EEE', year: 2 },
      { id: 'MENTOR_2ND_AIML', reg: 'MENTOR_REG_2ND_AIML', name: 'Dr. T. Hariprasath (2nd Yr AI & ML)', email: 'mentor.2nd.aiml@bitsathy.ac.in', dept: 'AI & ML', year: 2 },
      { id: 'MENTOR_2ND_CYBER', reg: 'MENTOR_REG_2ND_CYBER', name: 'Dr. P. Balamurugan (2nd Yr Cyber Security)', email: 'mentor.2nd.cyber@bitsathy.ac.in', dept: 'CSE (Cyber Security)', year: 2 },
      { id: 'MENTOR_2ND_MECH', reg: 'MENTOR_REG_2ND_MECH', name: 'Dr. G. Rajesh (2nd Yr Mechanical)', email: 'mentor.2nd.mech@bitsathy.ac.in', dept: 'Mechanical', year: 2 },
      { id: 'MENTOR_2ND_BIOTECH', reg: 'MENTOR_REG_2ND_BIOTECH', name: 'Dr. S. Anitha (2nd Yr Biotechnology)', email: 'mentor.2nd.biotech@bitsathy.ac.in', dept: 'Biotechnology', year: 2 },
      { id: 'MENTOR_2ND_CHEM', reg: 'MENTOR_REG_2ND_CHEM', name: 'Dr. V. Murugesan (2nd Yr Chemical)', email: 'mentor.2nd.chem@bitsathy.ac.in', dept: 'Chemical', year: 2 },
      { id: 'MENTOR_2ND_MECHATRONICS', reg: 'MENTOR_REG_2ND_MECHATRONICS', name: 'Prof. D. Vijay (2nd Yr Mechatronics)', email: 'mentor.2nd.mechatronics@bitsathy.ac.in', dept: 'Mechatronics', year: 2 },
      { id: 'MENTOR_2ND_CSBS', reg: 'MENTOR_REG_2ND_CSBS', name: 'Prof. K. Saravanan (2nd Yr CSBS)', email: 'mentor.2nd.csbs@bitsathy.ac.in', dept: 'CSBS', year: 2 }
    ];

    const allYearMentors = [...thirdYearMentors, ...secondYearMentors];

    for (const m of allYearMentors) {
      await sequelize.query(`
        INSERT INTO profiles (id_number, register_number, name, email, department, role, password_hash, mentor_year)
        VALUES (:id, :reg, :name, :email, :dept, 'mentor', 'mentor123', :year)
        ON CONFLICT (id_number) DO UPDATE
        SET role = 'mentor',
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            department = EXCLUDED.department,
            mentor_year = EXCLUDED.mentor_year,
            password_hash = COALESCE(profiles.password_hash, 'mentor123');
      `, {
        replacements: { id: m.id, reg: m.reg, name: m.name, email: m.email, dept: m.dept, year: m.year }
      });
    }

    console.log(`✅ Upserted ${allYearMentors.length} year-specific mentors.`);

    // 4. Auto-assign 3rd year students to 3rd year mentors
    for (const m of thirdYearMentors) {
      let deptFilter = `department = '${m.dept}'`;
      if (m.dept === 'CSE') {
        deptFilter = `(department = 'CSE' OR department = 'M.Tech CSE')`;
      } else if (m.dept === 'AI & ML') {
        deptFilter = `(department = 'AI & ML' OR department = 'CSE (AI & ML)')`;
      }

      await sequelize.query(`
        UPDATE profiles
        SET assigned_mentor_id = :mentorId
        WHERE role = 'student'
          AND (LOWER(id_number) LIKE '24%' OR register_number LIKE '%24%')
          AND ${deptFilter};
      `, {
        replacements: { mentorId: m.id }
      });
    }

    // 5. Auto-assign 2nd year students to 2nd year mentors
    for (const m of secondYearMentors) {
      let deptFilter = `department = '${m.dept}'`;
      if (m.dept === 'CSE') {
        deptFilter = `(department = 'CSE' OR department = 'M.Tech CSE')`;
      } else if (m.dept === 'AI & ML') {
        deptFilter = `(department = 'AI & ML' OR department = 'CSE (AI & ML)')`;
      }

      await sequelize.query(`
        UPDATE profiles
        SET assigned_mentor_id = :mentorId
        WHERE role = 'student'
          AND (LOWER(id_number) LIKE '25%' OR register_number LIKE '%25%')
          AND ${deptFilter};
      `, {
        replacements: { mentorId: m.id }
      });
    }

    // Assign any remaining unassigned 2nd year or 3rd year students to CSE mentors as default fallback
    await sequelize.query(`
      UPDATE profiles
      SET assigned_mentor_id = 'MENTOR_3RD_CSE'
      WHERE role = 'student'
        AND (LOWER(id_number) LIKE '24%' OR register_number LIKE '%24%')
        AND (assigned_mentor_id IS NULL OR assigned_mentor_id = '');
    `);

    await sequelize.query(`
      UPDATE profiles
      SET assigned_mentor_id = 'MENTOR_2ND_CSE'
      WHERE role = 'student'
        AND (LOWER(id_number) LIKE '25%' OR register_number LIKE '%25%')
        AND (assigned_mentor_id IS NULL OR assigned_mentor_id = '');
    `);

    console.log('✅ Students assigned to their respective 3rd and 2nd Year mentors successfully!');
  } catch (err) {
    console.error('❌ Error seeding year mentors:', err);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  seedYearMentors();
}

module.exports = seedYearMentors;
