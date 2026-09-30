require('dotenv').config();

const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const sequelize = require('./config/database');
const evidenceRoutes = require('./routes/evidenceRoutes');
const authRoutes = require('./routes/authRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const errorHandler = require('./middleware/errorHandler');
// Import models so sequelize.sync() creates their tables
require('./models/Student');
require('./models/VerificationAttempt');
const { startConsumer, stopConsumer } = require('./kafka/consumer');
const { connectProducer, disconnectProducer } = require('./kafka/producer');
const { closeBrowser } = require('./fetchers/browserPool');
const { getAllBreakers } = require('./resilience/circuitBreaker');
const logger = require('./utils/logger');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  const breakers = getAllBreakers();
  const breakerStatus = {};
  for (const [name, b] of Object.entries(breakers)) {
    breakerStatus[name] = {
      state: b.opened ? 'OPEN' : b.halfOpen ? 'HALF_OPEN' : 'CLOSED',
      stats: b.stats,
    };
  }

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    circuitBreakers: breakerStatus,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/evidence/coding', evidenceRoutes);
app.use('/api/verification', verificationRoutes);

app.use(errorHandler);

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connected');

    await sequelize.sync({ alter: true });
    logger.info('Database synced');

    try {
      await connectProducer();
      await startConsumer();
      logger.info('Kafka connected');
    } catch (kafkaErr) {
      logger.warn(`Kafka not available, running without event bus: ${kafkaErr.message}`);
    }

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    logger.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('Shutting down...');
  try {
    await stopConsumer();
    await disconnectProducer();
    await closeBrowser();
    await sequelize.close();
    logger.info('Graceful shutdown complete');
  } catch (error) {
    logger.error(`Shutdown error: ${error.message}`);
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();

module.exports = app;
