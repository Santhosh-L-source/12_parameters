require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const projectPubPatentRoutes = require('./routes/projectPubPatentRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/evidence/project-pub-patent', projectPubPatentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'Project/Publication/Patent', port: process.env.PORT });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3005;

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

module.exports = app;
