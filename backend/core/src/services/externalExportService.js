const sequelize = require('../config/database');

// Canonical 12 Parameters catalog
const CANONICAL_PARAMETERS = [
  { id: 'coding_problems', name: 'Coding Problems', max_marks: 25 },
  { id: 'cp_rating', name: 'Competitive Programming Rating', max_marks: 20 },
  { id: 'opensource', name: 'Open Source Contributions', max_marks: 20 },
  { id: 'competition', name: 'Competitions & Hackathons', max_marks: 20 },
  { id: 'internship', name: 'Internship & Startup', max_marks: 20 },
  { id: 'project', name: 'Project / Publication / Patent', max_marks: 30 },
  { id: 'language', name: 'Foreign Language', max_marks: 15 },
  { id: 'gate', name: 'GATE / Placement Exam', max_marks: 25 },
  { id: 'monthly_coding', name: 'Monthly Coding Assessment', max_marks: 20 },
  { id: 'hundred_days', name: '100 Days Training', max_marks: 15 },
  { id: 'aptitude', name: 'Aptitude & Communication', max_marks: 20 },
  { id: 'certificate', name: 'Certificate Achievement', max_marks: 20 }
];

/**
 * Calculate batch-based readiness threshold scaling multiplier
 * Rules:
 * - 2024-28 batch (Admission 2024): 75%
 * - 2023-27 batch (Admission 2023): 50% until end of 7th semester, 100% in 8th sem
 * - 2022-26 batch & earlier: 100%
 */
function getBatchScalingMultiplier(admissionYear, currentSemester = 1) {
  if (admissionYear === 2024) return 0.75;
  if (admissionYear === 2023) return currentSemester <= 7 ? 0.50 : 1.00;
  return 1.00;
}

/**
 * Infer admission year & semester from roll_number
 */
function inferAdmissionYearAndSemester(rollNumber) {
  const clean = String(rollNumber || '').toUpperCase().trim();
  const match = clean.match(/^(\d{2})/);
  const yr = match ? parseInt(match[1], 10) : 24;
  const admissionYear = 2000 + yr;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const yearsPassed = currentYear - admissionYear;
  const baseSem = yearsPassed * 2;
  const semester = Math.min(Math.max(currentMonth >= 8 ? baseSem + 1 : baseSem, 1), 8);

  return { admissionYear, semester };
}

/**
 * Compute Canonical Readiness Level Enum ('NOT_ELIGIBLE', 'L1', 'L2', 'L3', 'Elite')
 * Applies batch scaling multiplier & prerequisite condition: (monthly_coding >= 15 OR gate >= 15)
 */
function computeCanonicalLevel(totalMarks, paramMarksMap, admissionYear, currentSemester) {
  const mult = getBatchScalingMultiplier(admissionYear, currentSemester);

  const baseThresholds = {
    L1: 50,
    L2: 75,
    L3: 100,
    Elite: 130
  };

  const scaled = {
    L1: Math.round(baseThresholds.L1 * mult * 100) / 100,
    L2: Math.round(baseThresholds.L2 * mult * 100) / 100,
    L3: Math.round(baseThresholds.L3 * mult * 100) / 100,
    Elite: Math.round(baseThresholds.Elite * mult * 100) / 100
  };

  const monthlyCoding = paramMarksMap['monthly_coding'] || 0;
  const gateScore = paramMarksMap['gate'] || 0;
  const conditionMet = monthlyCoding >= 15 || gateScore >= 15;

  let assignedLevel = 'NOT_ELIGIBLE';

  if (totalMarks >= scaled.Elite) {
    assignedLevel = conditionMet ? 'Elite' : (totalMarks >= scaled.L1 ? 'L1' : 'NOT_ELIGIBLE');
  } else if (totalMarks >= scaled.L3) {
    assignedLevel = conditionMet ? 'L3' : (totalMarks >= scaled.L1 ? 'L1' : 'NOT_ELIGIBLE');
  } else if (totalMarks >= scaled.L2) {
    assignedLevel = conditionMet ? 'L2' : (totalMarks >= scaled.L1 ? 'L1' : 'NOT_ELIGIBLE');
  } else if (totalMarks >= scaled.L1) {
    assignedLevel = 'L1';
  }

  return {
    level: assignedLevel,
    level_condition_met: conditionMet,
    scaled_thresholds: scaled
  };
}

/**
 * Format single student output record strictly matching partner ERP spec
 */
function formatStudentOutput(profile, scoresList) {
  const { admissionYear, semester } = inferAdmissionYearAndSemester(profile.roll_number);

  const paramMarksMap = {};
  for (const s of scoresList) {
    paramMarksMap[s.parameter_id] = parseFloat(s.marks) || 0;
  }

  const parameterMarks = CANONICAL_PARAMETERS.map((p) => ({
    parameter_id: p.id,
    name: p.name,
    marks_obtained: paramMarksMap[p.id] !== undefined ? paramMarksMap[p.id] : 0,
    max_marks: p.max_marks
  }));

  const totalMarks = parameterMarks.reduce((sum, p) => sum + p.marks_obtained, 0);
  const roundedTotal = Math.round(totalMarks * 100) / 100;

  const { level, level_condition_met } = computeCanonicalLevel(
    roundedTotal,
    paramMarksMap,
    admissionYear,
    semester
  );

  return {
    roll_number: profile.roll_number,
    name: profile.name,
    department: profile.department || 'GENERAL',
    batch: profile.batch || `${admissionYear}-${admissionYear + 4}`,
    semester,
    total_marks: roundedTotal,
    max_possible_marks: 250,
    level, // 'NOT_ELIGIBLE' | 'L1' | 'L2' | 'L3' | 'Elite'
    level_condition_met,
    parameter_marks: parameterMarks
  };
}

/**
 * Service Methods
 */
const externalExportService = {
  /**
   * Get single student result
   */
  async getStudentResult(rollNumber) {
    const cleanId = String(rollNumber || '').trim();

    const profileRows = await sequelize.query(
      `SELECT roll_number, name, department, batch 
       FROM profiles 
       WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM(:cleanId))
       LIMIT 1`,
      { replacements: { cleanId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!profileRows || profileRows.length === 0) {
      return null;
    }

    const profile = profileRows[0];

    const scoreRows = await sequelize.query(
      `SELECT parameter_id, marks 
       FROM scores 
       WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM(:rollNumber))`,
      { replacements: { rollNumber: profile.roll_number }, type: sequelize.QueryTypes.SELECT }
    );

    return formatStudentOutput(profile, scoreRows || []);
  },

  /**
   * Bulk Export with Department & Batch filtering and pagination
   */
  async getBulkResults({ department, batch, page = 1, limit = 50 }) {
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
    const cleanLimit = Math.min(Math.max(1, parseInt(limit, 10)), 200);

    let whereConditions = [];
    const replacements = { limit: cleanLimit, offset };

    if (department) {
      whereConditions.push("LOWER(TRIM(department)) = LOWER(TRIM(:department))");
      replacements.department = department.trim();
    }
    if (batch) {
      whereConditions.push("LOWER(TRIM(batch)) = LOWER(TRIM(:batch))");
      replacements.batch = batch.trim();
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await sequelize.query(
      `SELECT COUNT(*) AS total FROM profiles ${whereClause}`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );
    const totalRecords = parseInt(countResult[0]?.total || 0, 10);

    const profiles = await sequelize.query(
      `SELECT roll_number, name, department, batch 
       FROM profiles 
       ${whereClause} 
       ORDER BY roll_number ASC 
       LIMIT :limit OFFSET :offset`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    if (!profiles || profiles.length === 0) {
      return {
        total: totalRecords,
        page: parseInt(page, 10),
        limit: cleanLimit,
        students: []
      };
    }

    const rollNumbers = profiles.map((p) => p.roll_number);

    const allScores = await sequelize.query(
      `SELECT roll_number, parameter_id, marks 
       FROM scores 
       WHERE roll_number IN (:rollNumbers)`,
      { replacements: { rollNumbers }, type: sequelize.QueryTypes.SELECT }
    );

    const scoresByStudent = {};
    for (const s of allScores) {
      if (!scoresByStudent[s.roll_number]) scoresByStudent[s.roll_number] = [];
      scoresByStudent[s.roll_number].push(s);
    }

    const students = profiles.map((p) =>
      formatStudentOutput(p, scoresByStudent[p.roll_number] || [])
    );

    return {
      total: totalRecords,
      page: parseInt(page, 10),
      limit: cleanLimit,
      students
    };
  },

  /**
   * Batch Lookup for explicit list of Roll Numbers
   */
  async getBatchLookupResults(rollNumbers = []) {
    if (!Array.isArray(rollNumbers) || rollNumbers.length === 0) {
      return [];
    }

    const cleanList = rollNumbers.map((r) => String(r).trim().toLowerCase()).filter(Boolean);

    const profiles = await sequelize.query(
      `SELECT roll_number, name, department, batch 
       FROM profiles 
       WHERE LOWER(TRIM(roll_number)) IN (:cleanList)`,
      { replacements: { cleanList }, type: sequelize.QueryTypes.SELECT }
    );

    if (!profiles || profiles.length === 0) {
      return [];
    }

    const rollNumbersFound = profiles.map((p) => p.roll_number);

    const allScores = await sequelize.query(
      `SELECT roll_number, parameter_id, marks 
       FROM scores 
       WHERE roll_number IN (:rollNumbersFound)`,
      { replacements: { rollNumbersFound }, type: sequelize.QueryTypes.SELECT }
    );

    const scoresByStudent = {};
    for (const s of allScores) {
      if (!scoresByStudent[s.roll_number]) scoresByStudent[s.roll_number] = [];
      scoresByStudent[s.roll_number].push(s);
    }

    return profiles.map((p) => formatStudentOutput(p, scoresByStudent[p.roll_number] || []));
  }
};

module.exports = externalExportService;
