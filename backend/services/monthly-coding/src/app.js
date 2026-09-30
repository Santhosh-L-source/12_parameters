require('dotenv').config();
const express = require('express');
const cors = require('cors');

const mentorRoutes = require('./routes/mentor');
const studentRoutes = require('./routes/student');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/mentor', mentorRoutes);
app.use('/api/student', studentRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
