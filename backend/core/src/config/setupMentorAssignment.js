const sequelize = require('./database');

async function setupMentorAssignment() {
  try {
    console.log('--- Setting up Mentor Assignment Schema ---');

    // 1. Add assigned_mentor_id column to profiles if not exists
    await sequelize.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS assigned_mentor_id TEXT;
    `);
    console.log('✅ Column assigned_mentor_id added/verified on profiles table');

    // 2. Ensure admin and mentor accounts exist
    await sequelize.query(`
      INSERT INTO profiles (id_number, register_number, name, email, department, role, password_hash)
      VALUES
        ('ADMIN', 'ADMIN_REG', 'Chief Academic Officer (Admin)', 'admin@hope.edu', 'ADMIN', 'admin', 'admin123'),
        ('MENTOR_CSE', 'MENTOR_REG_CSE', 'Dr. S. Raman (CSE Mentor)', 'mentor_cse@hope.edu', 'CSE', 'mentor', 'mentor123'),
        ('MENTOR_IT', 'MENTOR_REG_IT', 'Prof. V. Priya (IT Mentor)', 'mentor_it@hope.edu', 'IT', 'mentor', 'mentor123'),
        ('MENTOR_ECE', 'MENTOR_REG_ECE', 'Dr. K. Balaji (ECE Mentor)', 'mentor_ece@hope.edu', 'ECE', 'mentor', 'mentor123')
      ON CONFLICT (id_number) DO UPDATE
      SET role = EXCLUDED.role,
          name = EXCLUDED.name,
          department = EXCLUDED.department,
          password_hash = EXCLUDED.password_hash;
    `);
    console.log('✅ Admin & Mentors seeded');

    // 3. Assign students by department to corresponding mentors if null
    await sequelize.query(`
      UPDATE profiles 
      SET assigned_mentor_id = 'MENTOR_CSE' 
      WHERE role = 'student' AND department = 'CSE' AND (assigned_mentor_id IS NULL OR assigned_mentor_id = '');
    `);

    await sequelize.query(`
      UPDATE profiles 
      SET assigned_mentor_id = 'MENTOR_IT' 
      WHERE role = 'student' AND department = 'IT' AND (assigned_mentor_id IS NULL OR assigned_mentor_id = '');
    `);

    await sequelize.query(`
      UPDATE profiles 
      SET assigned_mentor_id = 'MENTOR_CSE' 
      WHERE role = 'student' AND (assigned_mentor_id IS NULL OR assigned_mentor_id = '');
    `);
    console.log('✅ Mentees assigned to mentors');

    // 4. Check counts
    const [counts] = await sequelize.query(`
      SELECT 
        COALESCE(assigned_mentor_id, 'UNASSIGNED') as mentor,
        COUNT(*) as student_count
      FROM profiles
      WHERE role = 'student'
      GROUP BY assigned_mentor_id;
    `);
    console.log('Assignment distribution:', counts);

  } catch (err) {
    console.error('Error in setupMentorAssignment:', err);
  } finally {
    await sequelize.close();
  }
}

setupMentorAssignment();
