require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { verifyCertificate } = require('./verifier');

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const SUPPORTED_TYPES = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
  'application/pdf': 'application/pdf',
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aptitude-communication', port: PORT });
});

app.get('/api/aptitude/marks/:studentId', (req, res) => {
  const { studentId } = req.params;
  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' });
  }
  res.json({
    studentId,
    module: 'Aptitude & Communication',
    maxMarks: 20,
    marks: 0,
    aptitudeMarks: 0,
    communicationMarks: 0,
    evidenceCount: 0,
  });
});

app.post('/api/verify', upload.single('certificate'), async (req, res) => {
  try {
    const file = req.file;
    const userName = (req.body.userName || '').trim();
    const rollNumber = (req.body.rollNumber || '').trim();

    if (!file) {
      return res.status(400).json({ error: 'No certificate file uploaded.' });
    }
    if (!userName) {
      return res.status(400).json({ error: 'Student name is required.' });
    }

    const resolvedType = SUPPORTED_TYPES[file.mimetype];
    if (!resolvedType) {
      return res.status(400).json({
        error: `Unsupported file type "${file.mimetype}". Upload a PDF or image (JPEG, PNG, WebP, GIF).`,
      });
    }

    if (file.size > 20 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum 20 MB.' });
    }

    const base64 = file.buffer.toString('base64');
    const result = await verifyCertificate(base64, resolvedType, userName, rollNumber);
    res.json(result);
  } catch (err) {
    console.error('[verify]', err);
    const message = err instanceof Error ? err.message : 'Verification failed';
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Aptitude & Communication server running on port ${PORT}`);
});
