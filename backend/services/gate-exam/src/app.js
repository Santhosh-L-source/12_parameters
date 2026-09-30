'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const gateRoutes = require('./routes/gateRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => res.json({ status: 'ok', module: 'Gate Exam', port: process.env.PORT }));

app.use('/api/gate', gateRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
  console.log(`GATE module running → http://localhost:${PORT}`);
});

module.exports = app;
