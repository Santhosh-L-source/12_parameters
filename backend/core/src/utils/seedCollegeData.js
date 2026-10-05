const xlsx = require('xlsx');
const path = require('path');
const sequelize = require('../config/database');

async function seedData() {
  console.log('--- STARTING COLLEGE DATA IMPORT ---');
  const excelPath = path.join(__dirname, '../../../../2029_August month college.xlsx');
  
  const workbook = xlsx.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawData || rawData.length < 2) {
    console.error('No data found in excel file');
    process.exit(1);
  }

  // Row 0 is headers
  // Headers: S.no, Roll no, Register No, Name, Department, College, Mail id, Percentage Score, ..., Mark(20)
  const rows = rawData.slice(1).filter(r => r[1] && String(r[1]).trim());
  console.log(`Found ${rows.length} student records to import.`);

  // 1. Ensure Mentors exist for departments
  const departments = [...new Set(rows.map(r => String(r[4] || 'CSE').trim().toUpperCase()).filter(Boolean))];
  console.log('Departments found:', departments);

  for (let i = 0; i < departments.length; i++) {
    const dept = departments[i];
    const mentorRoll = `MTR_${dept.replace(/[^A-Z0-9]/g, '_')}`;
    const mentorName = `Faculty Mentor (${dept})`;
    const mentorEmail = `mentor.${dept.toLowerCase().replace(/[^a-z0-9]/g, '')}@hope.edu`;

    await sequelize.query(`
      INSERT INTO mentors (roll_number, name, email, department, role, admin_roll_number, password_hash)
      VALUES (:roll, :name, :email, :dept, 'mentor', 'ADM001', 'mentor123')
      ON CONFLICT (roll_number) DO UPDATE SET name = :name, department = :dept;
    `, { replacements: { roll: mentorRoll, name: mentorName, email: mentorEmail, dept } });
  }

  // 2. Batch insert students and profiles
  const CHUNK_SIZE = 50;
  let insertedStudents = 0;
  let insertedScores = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    
    // Build Student Inserts
    const studentValues = [];
    const studentReplacements = {};
    
    // Build Profile Inserts
    const profileValues = [];
    const profileReplacements = {};

    // Build Monthly Coding Score Inserts
    const scoreValues = [];
    const scoreReplacements = {};

    chunk.forEach((row, idx) => {
      const rollNumber = String(row[1]).trim().toUpperCase();
      const registerNumber = row[2] ? String(row[2]).trim() : null;
      const name = String(row[3] || 'Student').trim().toUpperCase();
      const dept = String(row[4] || 'CSE').trim().toUpperCase();
      const email = row[6] ? String(row[6]).trim().toLowerCase() : `${rollNumber.toLowerCase()}@hope.edu`;
      const mentorRoll = `MTR_${dept.replace(/[^A-Z0-9]/g, '_')}`;
      
      const yr = rollNumber.startsWith('25') ? 2 : (rollNumber.startsWith('24') ? 3 : 1);
      const batch = yr === 2 ? '2029' : (yr === 3 ? '2028' : '2027');

      // Marks from Column 15 or Column 7
      let rawMark = parseFloat(row[15]);
      if (isNaN(rawMark)) rawMark = parseFloat(row[7]);
      const monthlyMark = !isNaN(rawMark) ? Math.min(Math.max(rawMark, 0), 20) : 0;

      // Student
      studentValues.push(`(:s_roll_${idx}, :s_reg_${idx}, :s_name_${idx}, :s_email_${idx}, :s_dept_${idx}, :s_batch_${idx}, :s_yr_${idx}, :s_mtr_${idx}, 'ADM001', 'student', :s_reg_${idx})`);
      studentReplacements[`s_roll_${idx}`] = rollNumber;
      studentReplacements[`s_reg_${idx}`] = registerNumber || rollNumber;
      studentReplacements[`s_name_${idx}`] = name;
      studentReplacements[`s_email_${idx}`] = email;
      studentReplacements[`s_dept_${idx}`] = dept;
      studentReplacements[`s_batch_${idx}`] = batch;
      studentReplacements[`s_yr_${idx}`] = yr;
      studentReplacements[`s_mtr_${idx}`] = mentorRoll;

      // Profile
      profileValues.push(`(:p_roll_${idx}, :p_name_${idx}, :p_dept_${idx}, :p_batch_${idx}, :p_tot_${idx}, :p_cod_${idx}, 'NOT_ELIGIBLE', 'Active')`);
      profileReplacements[`p_roll_${idx}`] = rollNumber;
      profileReplacements[`p_name_${idx}`] = name;
      profileReplacements[`p_dept_${idx}`] = dept;
      profileReplacements[`p_batch_${idx}`] = batch;
      profileReplacements[`p_tot_${idx}`] = monthlyMark;
      profileReplacements[`p_cod_${idx}`] = monthlyMark;

      // Monthly Coding Score
      scoreValues.push(`(:sc_roll_${idx}, 'monthly_coding', :sc_marks_${idx}, 3, false, NOW())`);
      scoreReplacements[`sc_roll_${idx}`] = rollNumber;
      scoreReplacements[`sc_marks_${idx}`] = monthlyMark;
    });

    // 1. Insert Students
    if (studentValues.length > 0) {
      try {
        await sequelize.query(`
          INSERT INTO students (roll_number, register_number, name, email, department, batch, year_of_study, mentor_roll_number, admin_roll_number, role, password_hash)
          VALUES ${studentValues.join(', ')}
          ON CONFLICT (roll_number) DO UPDATE SET 
            register_number = EXCLUDED.register_number,
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            department = EXCLUDED.department,
            batch = EXCLUDED.batch,
            year_of_study = EXCLUDED.year_of_study,
            mentor_roll_number = EXCLUDED.mentor_roll_number;
        `, { replacements: studentReplacements });
      } catch (err) {
        console.error('Error inserting students chunk detail:', err.parent?.message || err.message);
        throw err;
      }
    }

    // 2. Insert Profiles
    if (profileValues.length > 0) {
      try {
        await sequelize.query(`
          INSERT INTO profiles (roll_number, name, department, batch, total_score, coding_score, level, readiness_status)
          VALUES ${profileValues.join(', ')}
          ON CONFLICT (roll_number) DO UPDATE SET
            name = EXCLUDED.name,
            department = EXCLUDED.department,
            batch = EXCLUDED.batch,
            total_score = EXCLUDED.total_score;
        `, { replacements: profileReplacements });
      } catch (err) {
        console.error('Error inserting profiles chunk:', err.message);
        throw err;
      }
    }

    // 3. Insert Scores
    if (scoreValues.length > 0) {
      try {
        await sequelize.query(`
          INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
          VALUES ${scoreValues.join(', ')}
          ON CONFLICT (roll_number, parameter_id, semester) DO UPDATE SET
            marks = EXCLUDED.marks,
            calculated_at = NOW();
        `, { replacements: scoreReplacements });
      } catch (err) {
        console.error('Error inserting scores chunk:', err.message);
        throw err;
      }
    }

    insertedStudents += chunk.length;
    console.log(`Imported ${insertedStudents} / ${rows.length} students...`);
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Successfully populated ${insertedStudents} student records, profiles, and initial score parameters.`);
}

seedData().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
