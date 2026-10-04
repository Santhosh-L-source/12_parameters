const ExcelJS = require('exceljs');
const sequelize = require('../config/database');
const nodemailer = require('nodemailer');

const PARAMETER_KEYS = [
  'coding_problems',
  'cp_rating',
  'opensource',
  'competition',
  'internship',
  'project',
  'language',
  'gate',
  'monthly_coding',
  'hundred_days',
  'aptitude',
  'certificate'
];

const PARAMETER_LABELS = {
  coding_problems: 'Coding Problems (25)',
  cp_rating: 'CP Rating (20)',
  opensource: 'Open Source (20)',
  competition: 'Competition (20)',
  internship: 'Internship (20)',
  project: 'Project (30)',
  language: 'Language (15)',
  gate: 'GATE (25)',
  monthly_coding: 'Monthly Coding (20)',
  hundred_days: '100 Days (15)',
  aptitude: 'Aptitude (20)',
  certificate: 'Certificate (20)'
};

/**
 * Determine placement readiness tier and level text
 */
function getReadinessLevel(totalScore) {
  const score = parseFloat(totalScore) || 0;
  if (score >= 200) return 'Elite Tier (200+)';
  if (score >= 160) return 'Level 3 (160-199)';
  if (score >= 120) return 'Level 2 (120-159)';
  if (score >= 80) return 'Level 1 (80-119)';
  return 'Not Eligible (<80)';
}

/**
 * Extract clean sortable first name by stripping leading initials (e.g., 'S.P. AZHAGI' -> 'azhagi', 'S.SENTAMILAN' -> 'sentamilan')
 */
function getSortableFirstName(fullName) {
  if (!fullName) return '';
  let clean = String(fullName).trim();
  // Strip patterns like 'S. P. ', 'S.P. ', 'S.P.', 'A.G.', 'T K ', 'S. ', 'B.SRIVATSAN', 'S.K SARAVANA'
  clean = clean.replace(/^([A-Za-z][\.\s]\s*)+/i, '');
  clean = clean.replace(/^([A-Za-z]\.)+/i, '');
  // Also handle 1-2 letter standalone initials without dots like 'SP AZHAGI', 'TK SIVA'
  clean = clean.replace(/^[A-Za-z]{1,2}\s+(?=[A-Za-z]{3,})/i, '');
  clean = clean.replace(/^[\s\.\-]+/, '');
  return clean.length > 0 ? clean.toLowerCase() : String(fullName).trim().toLowerCase();
}

/**
 * Approximate student semester based on roll number
 */
function calculateSemesterFromRoll(rollNo) {
  if (!rollNo) return 1;
  const match = rollNo.match(/^(\d{2})/);
  if (!match) return 1;
  const admissionYear = 2000 + parseInt(match[1], 10);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const yearsPassed = currentYear - admissionYear;
  const baseSem = yearsPassed * 2;
  return Math.min(Math.max(currentMonth >= 8 ? baseSem + 1 : baseSem, 1), 8);
}

/**
 * Fetch and pivot student scores data
 */
async function getPivotedScoresData({ semester, department, search }) {
  // 1. Fetch student profiles
  let profileQuery = `
    SELECT 
      id_number, 
      register_number, 
      name, 
      department, 
      CASE 
        WHEN UPPER(COALESCE(college, '')) LIKE '%TECH%' THEN 'St. Joseph''s Institute of Technology'
        ELSE 'St. Joseph''s College of Engineering'
      END AS college,
      mentor_year
    FROM profiles
    WHERE role = 'student'
  `;
  const replacements = {};

  if (department && department !== 'ALL') {
    profileQuery += ` AND department = :department`;
    replacements.department = department;
  }

  if (search) {
    profileQuery += ` AND (LOWER(name) LIKE :search OR LOWER(id_number) LIKE :search OR LOWER(register_number) LIKE :search)`;
    replacements.search = `%${search.toLowerCase()}%`;
  }

  profileQuery += ` ORDER BY 
    CASE 
      WHEN UPPER(COALESCE(college, '')) LIKE '%TECH%' THEN 2 
      ELSE 1 
    END,
    department ASC, 
    LOWER(TRIM(name)) ASC,
    id_number ASC`;

  const students = await sequelize.query(profileQuery, {
    replacements,
    type: sequelize.QueryTypes.SELECT
  });

  if (students.length === 0) {
    return [];
  }

  // 2. Fetch all scores
  const allScores = await sequelize.query(
    `SELECT register_number, parameter, marks, semester 
     FROM scores`,
    { type: sequelize.QueryTypes.SELECT }
  );

  // Group scores by student identifier (matches roll_number or register_number)
  const scoresByStudent = new Map();
  for (const s of allScores) {
    const regKey = String(s.register_number).trim().toUpperCase();
    if (!scoresByStudent.has(regKey)) {
      scoresByStudent.set(regKey, new Map());
    }
    const paramKey = String(s.parameter || '').trim().toLowerCase();
    // Normalize aliases if any
    let canonical = paramKey;
    if (paramKey === 'coding') canonical = 'coding_problems';
    if (paramKey === 'cp') canonical = 'cp_rating';
    if (paramKey === 'oss' || paramKey === 'open_source') canonical = 'opensource';
    if (paramKey === 'month') canonical = 'monthly_coding';
    if (paramKey === 'proj') canonical = 'project';

    scoresByStudent.get(regKey).set(canonical, parseFloat(s.marks || 0));
  }

  // 3. Assemble pivoted rows
  const pivoted = [];
  for (const student of students) {
    const roll = student.id_number;
    const reg = student.register_number;
    const studentSem = calculateSemesterFromRoll(roll);

    // Filter by semester if specified
    if (semester && parseInt(semester, 10) !== studentSem) {
      continue;
    }

    const studentScores = scoresByStudent.get(roll.toUpperCase()) || 
                          scoresByStudent.get((reg || '').toUpperCase()) || 
                          new Map();

    const row = {
      college: student.college || "St. Joseph's Group of Institutions",
      department: student.department || 'General',
      roll_number: roll,
      name: student.name || 'Unknown',
      semester: studentSem,
      coding_problems: studentScores.get('coding_problems') || 0,
      cp_rating: studentScores.get('cp_rating') || 0,
      opensource: studentScores.get('opensource') || 0,
      competition: studentScores.get('competition') || 0,
      internship: studentScores.get('internship') || 0,
      project: studentScores.get('project') || 0,
      language: studentScores.get('language') || 0,
      gate: studentScores.get('gate') || 0,
      monthly_coding: studentScores.get('monthly_coding') || 0,
      hundred_days: studentScores.get('hundred_days') || 0,
      aptitude: studentScores.get('aptitude') || 0,
      certificate: studentScores.get('certificate') || 0,
    };

    // Calculate total marks across 12 parameters
    let total = 0;
    for (const key of PARAMETER_KEYS) {
      total += row[key];
    }
    row.total_marks = +total.toFixed(2);
    row.level = getReadinessLevel(row.total_marks);

    pivoted.push(row);
  }

  // Sort: 1. College (St. Joseph's College of Engineering first, then St. Joseph's Institute of Technology)
  //       2. Department (A-Z)
  //       3. First Name (A-Z, stripping leading initials like 'S. P ' or 'S. ' so 'S. P AZHAGI' sorts under 'Azhagi')
  //       4. Roll Number fallback
  pivoted.sort((a, b) => {
    const colA = a.college.includes('Technology') ? 2 : 1;
    const colB = b.college.includes('Technology') ? 2 : 1;
    if (colA !== colB) return colA - colB;

    const deptComp = (a.department || '').localeCompare(b.department || '');
    if (deptComp !== 0) return deptComp;

    const nameA = getSortableFirstName(a.name);
    const nameB = getSortableFirstName(b.name);
    const nameComp = nameA.localeCompare(nameB);
    if (nameComp !== 0) return nameComp;

    return (a.roll_number || '').localeCompare(b.roll_number || '');
  });

  return pivoted;
}

/**
 * Generate formatted Excel Workbook using ExcelJS
 */
async function generateScoresWorkbook({ semester, department, search }) {
  const data = await getPivotedScoresData({ semester, department, search });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HOPE Project Assessment System';
  workbook.lastModifiedBy = 'Admin';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetName = semester ? `Scores - Semester ${semester}` : 'Scores - All Students';
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] // Frozen top header row
  });

  // Define Columns with College and Department leading
  worksheet.columns = [
    { header: 'College', key: 'college', width: 34 },
    { header: 'Department', key: 'department', width: 16 },
    { header: 'Roll Number', key: 'roll_number', width: 16 },
    { header: 'Student Name', key: 'name', width: 28 },
    { header: 'Semester', key: 'semester', width: 12 },
    { header: PARAMETER_LABELS.coding_problems, key: 'coding_problems', width: 22 },
    { header: PARAMETER_LABELS.cp_rating, key: 'cp_rating', width: 18 },
    { header: PARAMETER_LABELS.opensource, key: 'opensource', width: 18 },
    { header: PARAMETER_LABELS.competition, key: 'competition', width: 18 },
    { header: PARAMETER_LABELS.internship, key: 'internship', width: 18 },
    { header: PARAMETER_LABELS.project, key: 'project', width: 18 },
    { header: PARAMETER_LABELS.language, key: 'language', width: 16 },
    { header: PARAMETER_LABELS.gate, key: 'gate', width: 16 },
    { header: PARAMETER_LABELS.monthly_coding, key: 'monthly_coding', width: 22 },
    { header: PARAMETER_LABELS.hundred_days, key: 'hundred_days', width: 18 },
    { header: PARAMETER_LABELS.aptitude, key: 'aptitude', width: 16 },
    { header: PARAMETER_LABELS.certificate, key: 'certificate', width: 18 },
    { header: 'Total Marks (250)', key: 'total_marks', width: 20 },
    { header: 'Readiness Level', key: 'level', width: 24 }
  ];

  // Style Header Row (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E1B4B' } // Deep Navy / Indigo
    };
    cell.font = {
      name: 'Segoe UI',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' } // White Text
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: false
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  // Populate Data Rows
  data.forEach((student, index) => {
    const row = worksheet.addRow(student);
    row.height = 22;

    const isEven = index % 2 === 0;
    const baseRowColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC'; // Zebra striping

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Default cell font & borders
      cell.font = { name: 'Calibri', size: 10.5 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Alignment rules:
      // 1: College (left), 2: Department (left/center), 3: Roll (center), 4: Name (left), 5: Semester (center), 6-19: Scores & Level
      if (colNumber === 1 || colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 2 || colNumber === 3 || colNumber === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Default background
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: baseRowColor }
      };

      // Conditional formatting for Total Marks (Col 18) & Level (Col 19)
      const totalScore = student.total_marks;
      if (colNumber === 18) {
        cell.font = { name: 'Calibri', size: 11, bold: true };
        if (totalScore >= 200) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } }; // Light Purple (Elite)
          cell.font.color = { argb: 'FF5B21B6' };
        } else if (totalScore >= 160) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }; // Light Sky (Level 3)
          cell.font.color = { argb: 'FF0369A1' };
        } else if (totalScore >= 120) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light Green (Level 2)
          cell.font.color = { argb: 'FF15803D' };
        } else if (totalScore >= 80) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light Amber (Level 1)
          cell.font.color = { argb: 'FFB45309' };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light Red
          cell.font.color = { argb: 'FFB91C1C' };
        }
      }

      if (colNumber === 19) {
        cell.font = { name: 'Calibri', size: 10.5, bold: true };
        if (totalScore >= 200) cell.font.color = { argb: 'FF5B21B6' };
        else if (totalScore >= 160) cell.font.color = { argb: 'FF0369A1' };
        else if (totalScore >= 120) cell.font.color = { argb: 'FF15803D' };
        else if (totalScore >= 80) cell.font.color = { argb: 'FFB45309' };
        else cell.font.color = { argb: 'FF991B1B' };
      }
    });
  });

  // Auto-fit column widths dynamically
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : '';
      if (cellValue.length > maxLength) {
        maxLength = cellValue.length;
      }
    });
    column.width = Math.max(column.width || 12, maxLength + 3);
  });

  return { workbook, totalRows: data.length };
}

/**
 * Send exported scores spreadsheet via email
 */
async function emailScoresExport({ recipientEmail, semester, department }) {
  const { workbook, totalRows } = await generateScoresWorkbook({ semester, department });
  const buffer = await workbook.xlsx.writeBuffer();

  const semLabel = semester ? `Semester_${semester}` : 'All_Semesters';
  const fileName = `Student_Scores_${semLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Use configured SMTP or standard fallback transport
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"HOPE Project Portal" <noreply@bitsathy.ac.in>',
    to: recipientEmail,
    subject: `📊 Student Scores Export Report (${semLabel.replace(/_/g, ' ')})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; color: #1e293b;">
        <h2 style="color: #4338ca;">HOPE Placement Readiness Scores Export</h2>
        <p>Hello,</p>
        <p>Attached is the requested official <strong>Student Scores Export</strong> in Microsoft Excel format.</p>
        <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Scope:</strong> ${semLabel.replace(/_/g, ' ')}</p>
          <p style="margin: 4px 0;"><strong>Total Students:</strong> ${totalRows}</p>
          <p style="margin: 4px 0;"><strong>Parameters Covered:</strong> All 12 Modules (Max 250 Marks)</p>
          <p style="margin: 4px 0;"><strong>Generated On:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="font-size: 0.85rem; color: #64748b;">This email was generated automatically by the HOPE Placement Assessment System.</p>
      </div>
    `,
    attachments: [
      {
        filename: fileName,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    ]
  };

  await transporter.sendMail(mailOptions);
  return { success: true, fileName, totalRows };
}

module.exports = {
  getPivotedScoresData,
  generateScoresWorkbook,
  emailScoresExport
};
