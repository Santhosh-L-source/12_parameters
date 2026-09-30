require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const db = require('./database');
const { verify, freshRunning } = require('./certificate-verifier');

const app = express();
const PORT = parseInt(process.env.PORT || '3011', 10);

const ROOT_DIR = path.join(__dirname, '..');
const UPLOAD_FOLDER = path.join(ROOT_DIR, 'uploads');
const CERT_STORE = path.join(ROOT_DIR, 'certificates');
const STATIC_DIR = path.join(ROOT_DIR, 'static');
const MENTOR_PASSWORD = process.env.MENTOR_PASSWORD || 'mentor@123';
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf']);

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Artificial Intelligence & ML',
  'Data Science',
  'Cyber Security',
  'Other',
];

const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];

fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
fs.mkdirSync(CERT_STORE, { recursive: true });

db.initDb();

app.set('view engine', 'ejs');
app.set('views', path.join(ROOT_DIR, 'views'));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(STATIC_DIR));

app.use(session({
  secret: process.env.SECRET_KEY || 'cert-verify-secret-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
}));

const upload = multer({
  dest: UPLOAD_FOLDER,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) cb(null, true);
    else cb(new Error('Unsupported file type. Use PNG, JPG, JPEG, WEBP or PDF.'));
  },
});

function mentorRequired(req, res, next) {
  if (!req.session.mentor_logged_in) {
    return res.redirect('/mentor/login');
  }
  next();
}

// Student routes

app.get('/', (req, res) => {
  res.render('index', { departments: DEPARTMENTS, semesters: SEMESTERS });
});

app.post('/verify', upload.single('certificate'), async (req, res) => {
  try {
    const { student_name, roll_number, semester, department, email } = req.body;

    const errors = {};
    if (!student_name || !student_name.trim()) errors.student_name = 'Required';
    if (!roll_number || !roll_number.trim()) errors.roll_number = 'Required';
    if (!semester || !semester.trim()) errors.semester = 'Required';
    if (!department || !department.trim()) errors.department = 'Required';
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: 'Missing fields', fields: errors });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No certificate uploaded.' });
    }

    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
    const tmpPath = req.file.path;

    const subId = uuidv4().replace(/-/g, '').slice(0, 12);
    const permName = `${subId}.${ext}`;
    const permPath = path.join(CERT_STORE, permName);
    fs.copyFileSync(tmpPath, permPath);

    const runningKey = `running_${roll_number.trim()}`;
    let running = req.session[runningKey];
    if (!running) running = freshRunning();
    if (running.seen && Array.isArray(running.seen)) {
      running.seen = new Set(running.seen);
    }

    const result = await verify(tmpPath, student_name.trim(), running);

    const updatedRunning = result._updated_running || null;
    if (updatedRunning) {
      if (updatedRunning.seen instanceof Set) {
        updatedRunning.seen = [...updatedRunning.seen];
      }
      req.session[runningKey] = updatedRunning;
    }
    delete result._updated_running;

    result.roll_number = roll_number.trim();
    result.semester = semester.trim();
    result.department = department.trim();
    result.email = (email || '').trim();
    result.cert_filename = req.file.originalname;
    result.cert_saved_path = permPath;

    db.saveSubmission(subId, result);
    result.submission_id = subId;

    res.json(result);

    try { fs.unlinkSync(tmpPath); } catch { /* ok */ }
  } catch (err) {
    console.error('[verify]', err);
    res.status(500).json({ error: `Verification error: ${String(err.message).slice(0, 300)}` });
  }
});

app.get('/status/:subId', (req, res) => {
  const sub = db.getSubmission(req.params.subId);
  if (!sub) return res.status(404).send('Submission not found');
  sub.verification_json = JSON.parse(sub.verification_json || '{}');
  sub.mentor_actions = JSON.parse(sub.mentor_actions || '[]');
  sub.mentor_reasons = JSON.parse(sub.mentor_reasons || '[]');
  res.render('submission', { sub, mentor_view: false });
});

app.get('/my-submissions', (req, res) => {
  res.render('my_submissions', { subs: [], roll: '' });
});

app.post('/my-submissions', (req, res) => {
  const roll = (req.body.roll_number || '').trim();
  const subs = roll ? db.getStudentSubmissions(roll) : [];
  res.render('my_submissions', { subs, roll });
});

app.post('/reset', (req, res) => {
  const roll = req.body.roll_number || '';
  if (roll) {
    delete req.session[`running_${roll}`];
  }
  res.json({ status: 'reset' });
});

// Mentor routes

app.get('/mentor/login', (req, res) => {
  res.render('mentor_login', { flash_error: null });
});

app.post('/mentor/login', (req, res) => {
  if ((req.body.password || '') === MENTOR_PASSWORD) {
    req.session.mentor_logged_in = true;
    return res.redirect('/mentor');
  }
  res.render('mentor_login', { flash_error: 'Incorrect password.' });
});

app.get('/mentor/logout', (req, res) => {
  req.session.mentor_logged_in = false;
  res.redirect('/mentor/login');
});

app.get('/mentor', mentorRequired, (req, res) => {
  const filterBy = req.query.filter || 'all';
  const allSubs = db.getAllSubmissions();
  const filters = {
    pending: s => s.mentor_decision === 'PENDING',
    eligible: s => s.final_status === 'ELIGIBLE',
    approved: s => s.mentor_decision === 'APPROVED',
    rejected: s => s.mentor_decision === 'REJECTED',
  };
  const subs = filters[filterBy] ? allSubs.filter(filters[filterBy]) : allSubs;
  const stats = db.getStats();
  const flashOk = req.session._flash_ok || null;
  req.session._flash_ok = null;
  res.render('mentor', { subs, stats, filter_by: filterBy, flash_ok: flashOk });
});

app.get('/mentor/submission/:subId', mentorRequired, (req, res) => {
  const sub = db.getSubmission(req.params.subId);
  if (!sub) return res.status(404).send('Not found');
  sub.verification_json = JSON.parse(sub.verification_json || '{}');
  sub.mentor_actions = JSON.parse(sub.mentor_actions || '[]');
  sub.mentor_reasons = JSON.parse(sub.mentor_reasons || '[]');
  sub.has_file = !!(sub.cert_saved_path && fs.existsSync(sub.cert_saved_path));
  res.render('submission', { sub, mentor_view: true });
});

app.get('/mentor/file/:subId', mentorRequired, (req, res) => {
  const sub = db.getSubmission(req.params.subId);
  if (!sub) return res.status(404).send('Not found');
  const saved = sub.cert_saved_path || '';
  if (!saved || !fs.existsSync(saved)) {
    return res.status(404).send('Certificate file not found on server.');
  }
  const ext = path.extname(saved).toLowerCase();
  const mime = ext === '.pdf' ? 'application/pdf' : `image/${ext.replace('.', '')}`;
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${sub.cert_filename || 'certificate' + ext}"`);
  fs.createReadStream(saved).pipe(res);
});

app.post('/mentor/review/:subId', mentorRequired, (req, res) => {
  const decision = (req.body.decision || '').toUpperCase();
  const comment = (req.body.comment || '').trim();
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    return res.redirect(`/mentor/submission/${req.params.subId}`);
  }
  db.updateMentorDecision(req.params.subId, decision, comment);
  req.session._flash_ok = `Submission ${req.params.subId} marked as ${decision}.`;
  res.redirect('/mentor?filter=pending');
});

// API endpoint for dashboard integration

app.get('/api/certificate/marks/:rollNumber', (req, res) => {
  try {
    const subs = db.getStudentSubmissions(req.params.rollNumber);
    const total = subs
      .filter(s => s.mentor_decision === 'APPROVED')
      .reduce((sum, s) => sum + (s.marks_awarded || 0), 0);
    res.json({
      studentId: req.params.rollNumber,
      module: 'Certificate Achievement',
      maxMarks: 20,
      marks: Math.min(total, 20),
      evidenceCount: subs.filter(s => s.mentor_decision === 'APPROVED').length,
    });
  } catch {
    res.json({
      studentId: req.params.rollNumber,
      module: 'Certificate Achievement',
      maxMarks: 20,
      marks: 0,
      evidenceCount: 0,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'certificate-achievement' });
});

app.listen(PORT, () => {
  console.log(`Certificate Achievement server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
