require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const evidenceRoutes = require('./routes/evidenceRoutes');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'D', service: 'internship-startup' });
});

app.use('/api/evidence/internship-startup', evidenceRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
    // Skip sync - tables already exist
    app.listen(PORT, () => console.log(`Module D running on port ${PORT}`));
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
