const sequelize = require('./database');

async function seedAdminMentor() {
  try {
    await sequelize.query(`
      INSERT INTO profiles (id_number, register_number, name, email, department, role, password_hash)
      VALUES
        ('ADMIN', 'ADMIN_REG', 'Chief Academic Officer (Admin)', 'admin@hope.edu', 'ADMIN', 'admin', 'admin123'),
        ('MENTOR_CSE', 'MENTOR_REG_CSE', 'Dr. S. Raman (CSE Mentor)', 'mentor_cse@hope.edu', 'CSE', 'mentor', 'mentor123'),
        ('MENTOR_IT', 'MENTOR_REG_IT', 'Prof. V. Priya (IT Mentor)', 'mentor_it@hope.edu', 'IT', 'mentor', 'mentor123')
      ON CONFLICT (id_number) DO UPDATE
      SET role = EXCLUDED.role,
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash;
    `);
    console.log('✅ Admin and Mentor profiles ready in database');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    await sequelize.close();
  }
}

seedAdminMentor();
