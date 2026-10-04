const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const sequelize = require('./database');

// Explicit roll fixes for 2029 batch
const ROLL_MAPPINGS = {
  '312425106015': '25EC1332',      // AISHWARYA .B.D
  '312425205086': '25IT1120',      // jerpsh rishal A
  '312425104183': '25CS1229',      // Premnath S
  '312325243008': '25AD378',       // Abu Huraira J
  '312425106032': '25EC1333',      // Avinash P
  '312425106182': '25EC1371',      // Suthiksha SL
  '312425205029': '25IT1137',      // Bharathi S S
  '312325205062': '25IT352',       // Harini G
  '312325104193': '25CS204',       // mythly
  '312425106128': '25EC1977',      // Pabitha M
  '312325205164': '25IT241',       // Prisha.D
  '312325205236': '25IT403',       // Surendhar M
  '312425104163': '25CS1124',      // Niveditha Nagappan
  '312325205255': '25IT255',       // yoganand S R
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
  '312325205221': '25IT180',       // Smrithi Angelin
  '312325104023': '25CS1023',      // Antonio
};

function sanitize(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''").trim()}'`;
}

async function bulkInsertProfiles(studentList) {
  // Deduplicate by rollNo within the batch
  const map = new Map();
  for (const s of studentList) {
    if (s.rollNo) {
      map.set(s.rollNo, s);
    }
  }
  const students = Array.from(map.values());

  const chunkSize = 200;
  for (let i = 0; i < students.length; i += chunkSize) {
    const chunk = students.slice(i, i + chunkSize);
    const profileValues = chunk.map(s => 
      `(${sanitize(s.rollNo)}, ${sanitize(s.regNo)}, ${sanitize(s.name)}, ${sanitize(s.email)}, ${sanitize(s.dept)}, ${sanitize(s.college)}, 'student', ${sanitize(s.regNo)})`
    ).join(',\n');

    await sequelize.query(`
      INSERT INTO profiles (id_number, register_number, name, email, department, college, role, password_hash)
      VALUES ${profileValues}
      ON CONFLICT (id_number) DO UPDATE
      SET register_number = EXCLUDED.register_number,
          name = EXCLUDED.name,
          department = EXCLUDED.department,
          college = EXCLUDED.college,
          password_hash = COALESCE(profiles.password_hash, EXCLUDED.register_number);
    `);

    const studentValues = chunk.map(s => 
      `(${sanitize(s.rollNo)}, ${sanitize(s.regNo)}, ${sanitize(s.name)}, ${sanitize(s.email)}, ${sanitize(s.dept)}, ${sanitize(s.college)}, ${sanitize(s.regNo)})`
    ).join(',\n');

    await sequelize.query(`
      INSERT INTO students (roll_number, register_number, name, email, department, college, password)
      VALUES ${studentValues}
      ON CONFLICT (roll_number) DO UPDATE
      SET register_number = EXCLUDED.register_number,
          name = EXCLUDED.name,
          department = EXCLUDED.department,
          college = EXCLUDED.college;
    `);
  }
}

async function setupDatabase() {
  try {
    console.log('🚀 Starting Fast Batch Database Setup on Supabase...');

    // 1. Create Core Tables
    console.log('📦 Step 1: Creating Core Tables...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS students (
        roll_number TEXT PRIMARY KEY,
        register_number TEXT,
        name TEXT NOT NULL,
        email TEXT,
        department TEXT,
        college TEXT,
        password TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mentors (
        id SERIAL PRIMARY KEY,
        mentor_id TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        department TEXT,
        password_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id_number TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('student', 'mentor', 'admin')),
        name TEXT NOT NULL,
        email TEXT,
        register_number TEXT,
        department TEXT,
        college TEXT,
        password_hash TEXT,
        mentor_year INT,
        assigned_mentor_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
      CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
      CREATE INDEX IF NOT EXISTS idx_profiles_register_number ON profiles(register_number);
    `);

    // 2. Create Parameters & Scores
    console.log('📦 Step 2: Creating Parameters & Scores Tables...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS parameters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        max_marks INTEGER NOT NULL CHECK (max_marks >= 0),
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO parameters (id, name, max_marks, description) VALUES
        ('hundred_days', '100 Days of Code', 20, 'Daily coding challenge track'),
        ('language', 'Foreign Language Proficiency', 15, 'JLPT / DELF / Goethe / NPTEL certifications'),
        ('gate', 'GATE Preparation', 15, 'GATE exam registration and mock scores'),
        ('competition', 'Competitions & Hackathons', 20, 'Hackathons and contest achievements'),
        ('internship', 'Internship & Startup Experience', 20, 'Industrial training and venture work'),
        ('certificate', 'Value Added Certifications', 20, 'Global tech and industry certs'),
        ('aptitude', 'Aptitude & Soft Skills', 15, 'Placement tests and interview prep'),
        ('coding', 'Coding Platform Problems', 25, 'LeetCode / Codeforces / HackerRank practice'),
        ('cp', 'Competitive Programming Rating', 20, 'Contest rank and Elo ratings'),
        ('oss', 'Open Source Contributions', 20, 'GitHub PRs, issues and repos'),
        ('month', 'Monthly Coding Assessments', 30, 'Internal monthly lab challenges'),
        ('proj', 'Capstone Projects & Research', 30, 'Publications, patents and product builds')
      ON CONFLICT (id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        register_number TEXT NOT NULL,
        academic_year INTEGER NOT NULL,
        hundred_days_score NUMERIC(5,2) DEFAULT 0,
        language_score NUMERIC(5,2) DEFAULT 0,
        gate_score NUMERIC(5,2) DEFAULT 0,
        competition_score NUMERIC(5,2) DEFAULT 0,
        internship_score NUMERIC(5,2) DEFAULT 0,
        certificate_score NUMERIC(5,2) DEFAULT 0,
        aptitude_score NUMERIC(5,2) DEFAULT 0,
        coding_score NUMERIC(5,2) DEFAULT 0,
        cp_score NUMERIC(5,2) DEFAULT 0,
        oss_score NUMERIC(5,2) DEFAULT 0,
        month_score NUMERIC(5,2) DEFAULT 0,
        proj_score NUMERIC(5,2) DEFAULT 0,
        total_score NUMERIC(5,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_scores_reg_year UNIQUE (register_number, academic_year)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        performed_by TEXT,
        student_id TEXT,
        details JSONB,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Create Evidence & Submissions Tables
    console.log('📦 Step 3: Creating Evidence Tables...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS monthly_coding_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        month_year TEXT,
        score NUMERIC(5,2) DEFAULT 0,
        verified BOOLEAN DEFAULT FALSE,
        submitted_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hundred_days_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        days_completed INTEGER DEFAULT 0,
        repo_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS certificate_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        course_name TEXT,
        issuing_org TEXT,
        certificate_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS certificate_submissions (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        title TEXT,
        issuer TEXT,
        file_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS language_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        language TEXT,
        level TEXT,
        score NUMERIC(5,2) DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS gate_exam_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        reg_number TEXT,
        mock_score NUMERIC(5,2) DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS competition_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        event_name TEXT,
        rank_or_position TEXT,
        certificate_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS internship_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        company_name TEXT,
        domain TEXT,
        offer_letter_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS aptitude_communication_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        test_type TEXT,
        score NUMERIC(5,2) DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS coding_problems_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        platform TEXT,
        problems_solved INTEGER DEFAULT 0,
        profile_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cp_rating_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        platform TEXT,
        current_rating INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS open_source_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        github_username TEXT,
        prs_merged INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_evidence (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        project_title TEXT,
        repo_or_paper_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Seed Admin
    console.log('📦 Step 4: Seeding Admin...');
    await sequelize.query(`
      INSERT INTO profiles (id_number, role, name, email, register_number, password_hash)
      VALUES 
        ('ADMIN001', 'admin', 'System Administrator', 'admin@hope.edu', 'ADMIN001', 'admin123'),
        ('admin', 'admin', 'System Administrator', 'admin@bitsathy.ac.in', 'admin', 'admin123')
      ON CONFLICT (id_number) DO UPDATE
      SET role = 'admin', password_hash = 'admin123';
    `);

    // 5. Import 3rd Year Students (2028 Batch)
    const thirdYearFile = 'C:/Users/victus/OneDrive/Attachments/OneDrive/Desktop/Hope_org/III Year Monthly COding Assessment Report - Engineering & Technology.xlsx';
    if (fs.existsSync(thirdYearFile)) {
      console.log('📦 Step 5: Fast Bulk Importing 3rd Year Students (2028 Batch)...');
      const wb3 = xlsx.readFile(thirdYearFile);
      const ws3 = wb3.Sheets[wb3.SheetNames[0]];
      const data3 = xlsx.utils.sheet_to_json(ws3, { header: 1 }).slice(1);

      const students3 = [];
      for (const row of data3) {
        const rollNo = row[1] ? String(row[1]).trim().toUpperCase() : null;
        const regNo = row[2] ? String(row[2]).trim() : null;
        const name = row[3] ? String(row[3]).trim() : null;
        const dept = row[4] ? String(row[4]).trim() : null;
        const college = row[5] ? String(row[5]).trim() : null;
        const email = row[6] ? String(row[6]).trim() : null;

        if (!rollNo || !regNo || !name) continue;
        students3.push({ rollNo, regNo, name, dept, college, email });
      }

      await bulkInsertProfiles(students3);
      console.log(`✅ Bulk imported ${students3.length} 3rd year students.`);
    }

    // 6. Import 2nd Year Students (2029 Batch)
    const secondYearFile = 'C:/Users/victus/OneDrive/Attachments/OneDrive/Desktop/HOPE_PROJECT/2029_August month college.xlsx';
    if (fs.existsSync(secondYearFile)) {
      console.log('📦 Step 6: Fast Bulk Importing 2nd Year Students (2029 Batch)...');
      const wb2 = xlsx.readFile(secondYearFile);
      const ws2 = wb2.Sheets[wb2.SheetNames[0]];
      const data2 = xlsx.utils.sheet_to_json(ws2, { header: 1 }).slice(1);

      const students2 = [];
      for (const row of data2) {
        let rollNo = row[1] ? String(row[1]).trim().toUpperCase() : null;
        const regNo = row[2] ? String(row[2]).trim() : null;
        const name = row[3] ? String(row[3]).trim() : null;
        const dept = row[4] ? String(row[4]).trim() : null;
        const college = row[5] ? String(row[5]).trim() : null;
        const email = row[6] ? String(row[6]).trim() : null;

        if (!regNo || !name) continue;

        // Apply clean roll mapping if present
        if (ROLL_MAPPINGS[regNo]) {
          rollNo = ROLL_MAPPINGS[regNo];
        } else if (rollNo && !rollNo.startsWith('25') && rollNo.startsWith('23')) {
          rollNo = '25' + rollNo.substring(2);
        } else if (rollNo && !rollNo.startsWith('25') && rollNo.startsWith('24')) {
          rollNo = '25' + rollNo.substring(2);
        } else if (!rollNo || !rollNo.startsWith('25')) {
          rollNo = '25' + (regNo.slice(-6));
        }

        students2.push({ rollNo, regNo, name, dept, college, email });
      }

      await bulkInsertProfiles(students2);
      console.log(`✅ Bulk imported ${students2.length} 2nd year students.`);
    }

    // 7. Seed Year Mentors and Assign
    console.log('📦 Step 7: Seeding Year Mentors and Auto-assigning...');
    const seedYearMentors = require('./seedYearMentors');
    await seedYearMentors();

    console.log('🎉 Full Database Setup & Migration Completed Successfully!');
  } catch (err) {
    console.error('❌ Error during setupDatabase:', err);
  } finally {
    await sequelize.close();
  }
}

setupDatabase();
