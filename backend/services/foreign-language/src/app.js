'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const languageEvidenceRoutes = require('./routes/languageEvidence');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => res.json({ status: 'ok', module: 'Foreign Language', port: process.env.PORT }));

app.use('/api/evidence/language', languageEvidenceRoutes);

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Foreign Language module running at http://localhost:${PORT}`);
});

module.exports = app;
