const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const os = require('os');

// Ensure upload directory exists (using system temp directory for serverless / local compatibility)
const uploadDir = path.join(os.tmpdir(), 'hope_uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('Upload dir warning:', e.message);
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeName}`);
  }
});

// Configure file filter for PDF and JPEG/JPG/PNG
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/pjpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  if (allowedExtensions.includes(ext) || allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only PDF, JPG, JPEG, and PNG files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter,
});

/**
 * POST /api/upload
 * Upload a PDF or JPEG/PNG document
 */
router.post('/', authenticate, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large',
          message: 'File size exceeds the 15MB limit.'
        });
      }
      return res.status(400).json({ success: false, error: err.code, message: err.message });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid File',
        message: err.message || 'Only PDF and JPG/JPEG/PNG files are supported.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No File Provided',
        message: 'Please select a PDF or JPEG/PNG file to upload.'
      });
    }

    // Read file buffer and generate persistent Data URI (never 404s on serverless)
    let dataUri = '';
    try {
      if (req.file.path && fs.existsSync(req.file.path)) {
        const fileBuffer = fs.readFileSync(req.file.path);
        const base64Data = fileBuffer.toString('base64');
        dataUri = `data:${req.file.mimetype || 'application/pdf'};base64,${base64Data}`;
      }
    } catch (readErr) {
      console.warn('Error generating data URI for upload:', readErr.message);
    }

    // Build public file URL with fallback to dataUri
    const localUrl = `/uploads/${req.file.filename}`;
    const persistentUrl = dataUri || localUrl;

    res.json({
      success: true,
      message: 'File uploaded successfully',
      fileUrl: persistentUrl,
      localUrl,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  });
});

/**
 * GET /api/upload/file/:filename
 * Retrieve uploaded document directly
 */
router.get('/file/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath1 = path.join(uploadDir, safeFilename);
  const filePath2 = path.join(__dirname, '../../uploads', safeFilename);

  let targetPath = null;
  if (fs.existsSync(filePath1)) targetPath = filePath1;
  else if (fs.existsSync(filePath2)) targetPath = filePath2;

  if (targetPath) {
    return res.sendFile(targetPath);
  }
  return res.status(404).json({ success: false, error: 'File not found' });
});

module.exports = router;
