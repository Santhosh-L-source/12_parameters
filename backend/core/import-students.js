/**
 * Bulk Student Import from Excel
 *
 * Reads the Monthly Coding Assessment Excel file and imports all students
 * into the database with proper credentials for login.
 *
 * Login Credentials:
 * - Username: Roll no (Column B) - e.g., "24CS360"
 * - Password: Register No (Column C) - e.g., "312324104001"
 */

const xlsx = require('xlsx');
const sequelize = require('./src/config/database');
const bcrypt = require('bcrypt');

const EXCEL_FILE_PATH = 'C:/Users/victus/OneDrive/Attachments/OneDrive/Desktop/HOPE_PROJECT/III Year Monthly COding Assessment Report - Engineering & Technology.xlsx';

async function importStudents() {
  let transaction;

  try {
    console.log('📊 Reading Excel file...');

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      console.error('');
      console.error('❌ ERROR: Excel file not found!');
      console.error('');
      console.error('Expected path:');
      console.error(`  ${EXCEL_FILE_PATH}`);
      console.error('');
      console.error('Solutions:');
      console.error('  1. Copy the Excel file to the expected location');
      console.error('  2. OR update line 16 in this script with the correct file path');
      console.error('');
      console.error('Example:');
      console.error('  const EXCEL_FILE_PATH = "C:/Your/Actual/Path/To/File.xlsx";');
      console.error('');
      process.exit(1);
    }

    // Read Excel file
    const workbook = xlsx.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Extract data (skip header row)
    const rows = data.slice(1).filter(row => row.length > 0);

    console.log(`✅ Found ${rows.length} students in Excel file`);
    console.log('');

    // NO TRANSACTION - Process each student independently
    // This prevents one error from aborting all remaining inserts
    transaction = null;

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    console.log('🔄 Processing students...');
    console.log('');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // Excel row number

      try {
        // Extract columns
        const rollNo = row[1] ? String(row[1]).trim() : null;        // Column B: Roll no
        const registerNo = row[2] ? String(row[2]).trim() : null;    // Column C: Register No
        const name = row[3] ? String(row[3]).trim() : null;          // Column D: Name
        const department = row[4] ? String(row[4]).trim() : null;    // Column E: Department
        const college = row[5] ? String(row[5]).trim() : null;       // Column F: College
        const email = row[6] ? String(row[6]).trim() : null;         // Column G: Mail id

        // Validate required fields
        if (!rollNo || !registerNo || !name || !email) {
          errors.push({
            row: rowIndex,
            rollNo: rollNo || 'N/A',
            name: name || 'N/A',
            error: 'Missing required fields (Roll no, Register no, Name, or Email)'
          });
          failed++;
          continue;
        }

        // Check if student already exists
        const [students] = await sequelize.query(
          'SELECT roll_number FROM students WHERE roll_number = :rollNo',
          {
            replacements: { rollNo },
            type: sequelize.QueryTypes.SELECT
          }
        );

        if (students && students.length > 0) {
          // Update existing student - store register_number in password field temporarily
          await sequelize.query(
            `UPDATE students
             SET name = :name,
                 email = :email,
                 department = :department,
                 college = :college,
                 register_number = :registerNo,
                 password = :registerNo
             WHERE roll_number = :rollNo`,
            {
              replacements: {
                name,
                email,
                department,
                college,
                registerNo,
                rollNo
              }
            }
          );
          updated++;
        } else {
          // Insert new student - store register_number in password field temporarily
          await sequelize.query(
            `INSERT INTO students (
               roll_number, register_number, name, email,
               department, college, password, created_at
             ) VALUES (
               :rollNo, :registerNo, :name, :email,
               :department, :college, :registerNo, NOW()
             )`,
            {
              replacements: {
                rollNo,
                registerNo,
                name,
                email,
                department,
                college
              }
            }
          );
          inserted++;
        }

        // Progress indicator (every 50 students for 2331 total)
        if ((i + 1) % 50 === 0 || (i + 1) === rows.length) {
          const progress = ((i + 1) / rows.length * 100).toFixed(1);
          console.log(`  Processed ${i + 1}/${rows.length} students (${progress}%)... [✅ ${inserted + updated} | ❌ ${failed}]`);
        }

      } catch (rowError) {
        // Silently skip validation errors (duplicates) to speed up import
        if (!rowError.message.includes('Validation error')) {
          console.error(`❌ Error processing row ${rowIndex}:`, rowError.message);
        }
        errors.push({
          row: rowIndex,
          rollNo: row[1] || 'Unknown',
          name: row[3] || 'Unknown',
          error: rowError.message
        });
        failed++;
      }
    }

    // No transaction to commit - each insert was independent

    // Summary
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ STUDENT IMPORT COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log(`Total students in Excel: ${rows.length}`);
    console.log(`✅ Inserted (new):       ${inserted}`);
    console.log(`🔄 Updated (existing):   ${updated}`);
    console.log(`❌ Failed:               ${failed}`);
    console.log('');

    if (errors.length > 0) {
      console.log('❌ ERRORS:');
      errors.slice(0, 10).forEach(err => {
        console.log(`  Row ${err.row}: ${err.rollNo} - ${err.error}`);
      });
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔐 LOGIN CREDENTIALS:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Username: Roll no (e.g., 24CS360)');
    console.log('  Password: Register no (e.g., 312324104001)');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // Show sample students
    const [sampleStudents] = await sequelize.query(
      'SELECT roll_number, register_number, name, email FROM students ORDER BY roll_number LIMIT 5'
    );

    console.log('📋 Sample Students:');
    sampleStudents.forEach(s => {
      console.log(`  ${s.roll_number} | ${s.name} | ${s.email}`);
    });

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR:', error.message);
    console.error(error.stack);

    // No transaction to rollback - show what was imported before error
    console.log('ℹ️ Partial import may have completed before error occurred');

    await sequelize.close();
    process.exit(1);
  }
}

// Run import
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('🚀 STUDENT BULK IMPORT');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log(`📁 Source: ${EXCEL_FILE_PATH}`);
console.log('');

importStudents();
