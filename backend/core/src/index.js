try { require('dotenv').config(); } catch (e) {}
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const projectPubPatentRoutes = require('./routes/projectPubPatentRoutes');
const hundredDaysRoutes = require('./routes/hundredDaysRoutes');
const languageRoutes = require('./routes/languageRoutes');
const gateExamRoutes = require('./routes/gateExamRoutes');
const competitionRoutes = require('./routes/competitionRoutes');
const internshipRoutes = require('./routes/internshipRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const aptitudeCommunicationRoutes = require('./routes/aptitudeCommunicationRoutes');
const codingProblemsRoutes = require('./routes/codingProblemsRoutes');
const cpRatingRoutes = require('./routes/cpRatingRoutes');
const openSourceRoutes = require('./routes/openSourceRoutes');
const monthlyCodingRoutes = require('./routes/monthlyCodingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const anomalyRoutes = require('./routes/anomalyRoutes');
const mentorRoutes = require('./routes/mentorRoutes');

const path = require('path');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded documents (PDFs, Images) statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/upload', uploadRoutes);
app.use('/api/evidence/project-pub-patent', projectPubPatentRoutes);
app.use('/api/project-pub-patent', projectPubPatentRoutes);
app.use('/api/hundred-days', hundredDaysRoutes);
app.use('/api/language', languageRoutes);
app.use('/api/gate', gateExamRoutes);
app.use('/api/competition', competitionRoutes);
app.use('/api/internship', internshipRoutes);
app.use('/api/certificate', certificateRoutes);
app.use('/api/aptitude-communication', aptitudeCommunicationRoutes);
app.use('/api/coding-problems', codingProblemsRoutes);
app.use('/api/cp-rating', cpRatingRoutes);
app.use('/api/open-source', openSourceRoutes);
app.use('/api/monthly-coding', monthlyCodingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/anomaly', anomalyRoutes);

app.get('/', (req, res) => {
  res.json({ success: true, status: 'ok', message: 'HOPE 12-Parameters Academic Backend Service' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'Project/Publication/Patent', port: process.env.PORT });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3005;

if (require.main === module) {
  sequelize
    .authenticate()
    .then(() => {
      console.log('Database connected');
      // Skip sync - tables already exist
      app.listen(PORT, () => {
        console.log(`Project/Publication/Patent service running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Unable to start server:', err);
    });
}

module.exports = app;
