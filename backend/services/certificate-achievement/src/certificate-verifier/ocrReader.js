const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

let worker = null;

async function getWorker() {
  if (!worker) {
    worker = await Tesseract.createWorker('eng');
  }
  return worker;
}

async function pdfToImages(pdfPath) {
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch { return []; }

  const buf = fs.readFileSync(pdfPath);
  const images = [];
  try {
    const imgBuf = await sharp(buf, { density: 200 }).png().toBuffer();
    images.push(imgBuf);
  } catch {
    try {
      const imgBuf = await sharp(buf).png().toBuffer();
      images.push(imgBuf);
    } catch { /* PDF with multiple pages — try text extraction */ }
  }
  return images;
}

async function extractTextFromPdf(pdfPath) {
  try {
    const pdfParse = require('pdf-parse');
    const buf = fs.readFileSync(pdfPath);
    const data = await pdfParse(buf);
    if (data.text && data.text.trim().length > 20) {
      return data.text;
    }
  } catch { /* fall through to OCR */ }
  return null;
}

async function preprocess(imagePath) {
  const buf = fs.readFileSync(imagePath);
  const processed = await sharp(buf)
    .greyscale()
    .resize({ width: 1200, withoutEnlargement: false })
    .sharpen()
    .png()
    .toBuffer();
  return processed;
}

async function extractText(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();

  if (ext === '.pdf') {
    const textContent = await extractTextFromPdf(imagePath);
    if (textContent) {
      const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);
      const rawText = lines.join(' ');
      return { raw_text: rawText, lines, name_candidates: extractNameCandidates(lines, rawText) };
    }
    const images = await pdfToImages(imagePath);
    if (images.length > 0) {
      const w = await getWorker();
      let allLines = [];
      for (const imgBuf of images) {
        const { data } = await w.recognize(imgBuf);
        const pageLines = data.text.split('\n').map(l => l.trim()).filter(Boolean);
        allLines = allLines.concat(pageLines);
      }
      const rawText = allLines.join(' ');
      return { raw_text: rawText, lines: allLines, name_candidates: extractNameCandidates(allLines, rawText) };
    }
    return { raw_text: '', lines: [], name_candidates: [] };
  }

  try {
    const processed = await preprocess(imagePath);
    const w = await getWorker();
    const { data } = await w.recognize(processed);
    const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);
    const rawText = lines.join(' ');
    return { raw_text: rawText, lines, name_candidates: extractNameCandidates(lines, rawText) };
  } catch (err) {
    throw new Error(`OCR failed: ${err.message}`);
  }
}

const BEFORE_NAME = [
  'this is to certify that',
  'certif(?:ies|ied) that',
  'awarded to',
  'presented to',
  'issued to',
  'this certifies that',
  'conferred upon',
  'this certificate is awarded to',
  'successfully completed by',
];

const AFTER_NAME = [
  'has (?:successfully )?(?:completed|earned|achieved|passed)',
  'is hereby (?:awarded|certified)',
  'for (?:successfully )?completing',
  'having (?:successfully )?completed',
];

const CERT_TITLE_WORDS = new Set([
  'aws', 'google', 'microsoft', 'cisco', 'oracle', 'comptia',
  'certified', 'certification', 'certificate', 'professional',
  'associate', 'foundation', 'engineer', 'architect', 'developer',
  'administrator', 'practitioner', 'nptel', 'swayam',
]);

function isCertTitle(line) {
  const words = new Set(line.split(/\s+/).map(w => w.toLowerCase()));
  for (const w of words) {
    if (CERT_TITLE_WORDS.has(w)) return true;
  }
  return false;
}

function extractNameCandidates(lines, raw) {
  const candidates = [];
  const combined = lines.join(' ');
  const beforePat = BEFORE_NAME.join('|');
  const afterPat = AFTER_NAME.join('|');

  const re1 = new RegExp(`(?:${beforePat})\\s+([A-Z][a-zA-Z .'\\x60\\-]{3,60}?)\\s+(?:${afterPat})`, 'i');
  const m1 = combined.match(re1);
  if (m1) candidates.push(m1[1].trim());

  for (const line of lines) {
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5
        && !/\d/.test(line)
        && words.every(w => w.length > 0 && w[0] === w[0].toUpperCase())
        && !isCertTitle(line)) {
      candidates.push(line);
    }
  }

  const beforeRe = new RegExp(beforePat, 'i');
  for (let i = 0; i < lines.length; i++) {
    if (beforeRe.test(lines[i]) && i + 1 < lines.length) {
      const nxt = lines[i + 1].trim();
      const afterRe = new RegExp(beforePat + '|' + afterPat, 'i');
      if (nxt && !afterRe.test(nxt)) {
        candidates.push(nxt);
      }
    }
  }

  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const key = c.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(c); }
  }
  return unique;
}

module.exports = { extractText };
