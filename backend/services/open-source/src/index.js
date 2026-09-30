require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const opensourceRoutes = require('./routes/opensourceRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/evidence/opensource', opensourceRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'Open-Source Contribution', port: process.env.PORT });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3002;

sequelize
  .authenticate()
  .then(() => {
    console.log('Database connected');
    // Skip sync - table already exists
    app.listen(PORT, () => {
      console.log(`Open-Source service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Unable to start server:', err);
  });

module.exports = app;
