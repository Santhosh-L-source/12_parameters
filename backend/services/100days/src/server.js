require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { adminRouter, studentRouter } = require('./index');

const app = express();
const PORT = process.env.PORT || 3009;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.set('db', pool);

app.use(express.json());

app.use((req, _res, next) => {
  req.user = { id: req.headers['x-student-id'] || req.query.studentId || 'anonymous' };
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', module: '100 Days Training', port: PORT }));

app.use('/api/admin/hundred-days', adminRouter);
app.use('/api/student/hundred-days', studentRouter);

app.get('/api/hundred-days/marks/:studentId', async (req, res) => {
  try {
    const db = pool;
    const studentId = req.params.studentId;

    const { rows } = await db.query(
      `SELECT s.awarded_mark, s.awarded_category
       FROM hundred_days_scores s
       JOIN students st ON st.id = s.student_id
       WHERE st.register_number = $1
       LIMIT 1`,
      [studentId]
    );

    if (!rows || rows.length === 0) {
      return res.json({
        studentId,
        module: '100 Days Training',
        maxMarks: 15,
        marks: 0,
        category: 'Not selected',
      });
    }

    return res.json({
      studentId,
      module: '100 Days Training',
      maxMarks: 15,
      marks: rows[0].awarded_mark || 0,
      category: rows[0].awarded_category || 'Not selected',
    });
  } catch (err) {
    return res.json({
      studentId: req.params.studentId,
      module: '100 Days Training',
      maxMarks: 15,
      marks: 0,
      category: 'Not selected',
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

pool.query('SELECT 1')
  .then(() => {
    console.log('Database connected');
    app.listen(PORT, () => console.log(`100 Days Training module running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    console.log('Starting server without DB...');
    app.listen(PORT, () => console.log(`100 Days Training module running on port ${PORT} (no DB)`));
  });

module.exports = app;
