const { normalizeRegisterNumber, normalizeName, namesMatch } = require('../utils/normalize');

/**
 * Match parsed file rows against the students table.
 *
 * Returns { entries, summary } where entries is ready for bulk insert
 * into hundred_days_entries.
 */
async function matchEntries(rows, db) {
  // Collect all unique register numbers from the file
  const registerNumbers = [
    ...new Set(rows.map(r => normalizeRegisterNumber(r.register_number)).filter(Boolean))
  ];

  // Fetch all potentially matching students in one query
  const { rows: students } = await db.query(
    `SELECT id, register_number, name FROM students WHERE UPPER(TRIM(register_number)) = ANY($1)`,
    [registerNumbers]
  );

  const studentMap = {};
  for (const s of students) {
    studentMap[normalizeRegisterNumber(s.register_number)] = s;
  }

  // Detect duplicates within the file
  const seenRegNums = {};
  for (const row of rows) {
    const key = normalizeRegisterNumber(row.register_number);
    if (!seenRegNums[key]) {
      seenRegNums[key] = [];
    }
    seenRegNums[key].push(normalizeName(row.name));
  }

  const entries = [];
  const summary = {
    total: rows.length,
    matched: 0,
    unmatched: 0,
    nameConflicts: 0,
    duplicatesInFile: 0,
    invalidRows: 0,
    unmatchedRegNums: [],
    nameConflictDetails: [],
  };

  const processedKeys = new Set();

  for (const row of rows) {
    const rawRegNum = String(row.register_number ?? '');
    const rawName = String(row.name ?? '');
    const regNum = normalizeRegisterNumber(rawRegNum);
    const nameInFile = normalizeName(rawName);

    if (!regNum) {
      summary.invalidRows++;
      continue;
    }

    if (!rawName.trim()) {
      summary.invalidRows++;
      continue;
    }

    // Duplicate within file: same register number appears more than once
    const nameVariants = seenRegNums[regNum] || [];
    const isDuplicateInFile = nameVariants.length > 1;
    if (isDuplicateInFile && processedKeys.has(regNum)) {
      summary.duplicatesInFile++;
      continue;
    }
    processedKeys.add(regNum);

    const student = studentMap[regNum];
    let matchStatus;
    let matchedStudentId = null;

    if (!student) {
      matchStatus = 'UNMATCHED';
      summary.unmatched++;
      summary.unmatchedRegNums.push(regNum);
    } else if (!namesMatch(nameInFile, student.name)) {
      matchStatus = 'NAME_CONFLICT';
      summary.nameConflicts++;
      summary.nameConflictDetails.push({
        registerNumber: regNum,
        nameInFile: nameInFile,
        nameInSystem: normalizeName(student.name),
      });
    } else {
      matchStatus = 'MATCHED';
      matchedStudentId = student.id;
      summary.matched++;
    }

    entries.push({
      register_number: regNum,
      name_in_file: nameInFile,
      matched_student_id: matchedStudentId,
      match_status: matchStatus,
      raw_register_number: rawRegNum,
      raw_name: rawName,
    });
  }

  return { entries, summary };
}

module.exports = { matchEntries };
