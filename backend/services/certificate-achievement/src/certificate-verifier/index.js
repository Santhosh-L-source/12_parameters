const { extractText } = require('./ocrReader');
const { findCertInMatrix } = require('./matrixLookup');
const { findBestNameInOcr } = require('./nameMatcher');
const { decodeQr } = require('./qrReader');
const { verifyUrl } = require('./urlVerifier');
const { calculate, freshRunning } = require('./marksCalculator');
const path = require('path');

async function verify(imagePath, studentName, running) {
  if (!running) running = freshRunning();

  const report = {
    student_name: studentName,
    file: path.basename(imagePath),
    steps: {},
    final_status: '',
    marks_awarded: 0,
    running_total: running.total || 0,
    reason: [],
    mentor_action: [],
  };

  // STEP 1: OCR
  let ocrData;
  try {
    ocrData = await extractText(imagePath);
  } catch (e) {
    return fail(report, 'OCR failed', e.message, running);
  }

  report.steps.ocr = {
    lines_detected: (ocrData.lines || []).length,
    sample: (ocrData.lines || []).slice(0, 5),
  };

  // STEP 2: Matrix lookup
  const matrixResult = findCertInMatrix(ocrData.raw_text);
  report.steps.matrix = {
    found: matrixResult.found,
    matched_entry: matrixResult.matched_key,
    detected_level: matrixResult.detected_level,
    reason: matrixResult.reason,
  };

  if (!matrixResult.found) {
    report.reason.push(matrixResult.reason);
    report.mentor_action.push('Confirm whether this credential is approved and add it to the matrix if so.');
    report.final_status = 'MENTOR REVIEW REQUIRED';
    return report;
  }

  const entry = matrixResult.entry;
  const detectedLevel = matrixResult.detected_level;
  const certName = matrixResult.matched_key;

  // STEP 3: Name match
  const nameResult = findBestNameInOcr(ocrData, studentName);
  report.steps.name_match = {
    found: nameResult.found,
    cert_name: nameResult.cert_name,
    registered_name: studentName,
    match: nameResult.match,
    reason: nameResult.reason,
  };

  if (!nameResult.found || !nameResult.match) {
    report.reason.push(
      `Name mismatch: '${nameResult.cert_name}' != '${studentName}'. ${nameResult.reason || ''}`
    );
    report.mentor_action.push('Verify student identity — name on certificate does not match the registered name.');
    report.final_status = 'MENTOR REVIEW REQUIRED';
    return report;
  }

  const certHolder = nameResult.cert_name;

  // STEP 4: QR / URL verification
  let urls = [];
  try { urls = await decodeQr(imagePath); } catch { /* skip */ }

  const ocrUrls = (ocrData.raw_text || '').match(/https?:\/\/[^\s\]\[<>"]{8,}/g) || [];
  const allUrls = [...new Set([...urls, ...ocrUrls])];

  if (allUrls.length > 0) {
    const url = allUrls[0];
    const urlResult = await verifyUrl(url, certHolder, certName);
    report.steps.url_verification = urlResult;

    if (urlResult.status !== 'PASSED') {
      report.reason.push(`URL verification failed: ${urlResult.reason}`);
      report.mentor_action.push(`Manually check verification URL: ${url}  —  ${urlResult.reason}`);
      report.final_status = 'MENTOR REVIEW REQUIRED';
      return report;
    }
  } else {
    report.steps.url_verification = {
      present: false,
      status: 'NOT PRESENT',
      reason: 'No QR code or verification URL detected.',
    };
  }

  // STEP 5: Marks
  const marksResult = calculate(entry, detectedLevel, running);
  const awarded = marksResult.marks_awarded;
  const newRunning = marksResult.updated_running;

  report.steps.marks = {
    tier: entry.tier,
    base_marks: entry.marks || 'level-based',
    awarded,
    reason: marksResult.reason,
  };
  report.marks_awarded = awarded;
  report.running_total = newRunning.total;
  report._updated_running = newRunning;

  report.final_status = 'ELIGIBLE';
  report.reason.push(marksResult.reason);

  return report;
}

function fail(report, step, reason, running) {
  report.final_status = 'MENTOR REVIEW REQUIRED';
  report.reason.push(`${step}: ${reason}`);
  report.mentor_action.push(`Technical failure at ${step} — manual review required.`);
  report.running_total = running.total || 0;
  return report;
}

module.exports = { verify, freshRunning };
