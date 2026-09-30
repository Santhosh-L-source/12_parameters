const kafka = require('../config/kafka');
const config = require('../config/config');
const logger = require('../utils/logger');
const CodingEvidence = require('../models/CodingEvidence');
const { getFetcher } = require('../fetchers');
const { publishFetchCompleted, publishFetchFailed } = require('./producer');

const consumer = kafka.consumer({ groupId: config.kafka.groupId });
let running = false;

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topic: config.kafka.topics.fetchRequested,
    fromBeginning: false,
  });

  running = true;
  logger.info('Kafka consumer started');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value.toString());
      const { evidenceId, platform, profileUrl } = payload;

      logger.info(`Processing fetch for evidence ${evidenceId} (${platform})`);

      try {
        const fetcher = getFetcher(platform);
        const result = await fetcher(profileUrl);

        await CodingEvidence.update(
          {
            totalProblemsSolved: result.totalProblemsSolved,
            sqlProblemsSolved: result.sqlProblemsSolved,
            fetchedAt: new Date(),
            status: 'PENDING',
          },
          { where: { id: evidenceId } }
        );

        const updated = await CodingEvidence.findByPk(evidenceId);
        await publishFetchCompleted(updated);

        logger.info(
          `Fetch completed for evidence ${evidenceId}: total=${result.totalProblemsSolved}, sql=${result.sqlProblemsSolved}`
        );
      } catch (error) {
        logger.error(`Fetch failed for evidence ${evidenceId}: ${error.message}`);

        await CodingEvidence.update(
          { status: 'FETCH_FAILED' },
          { where: { id: evidenceId } }
        );

        await publishFetchFailed(evidenceId, error);
      }
    },
  });
}

async function stopConsumer() {
  if (!running) return;
  await consumer.disconnect();
  running = false;
  logger.info('Kafka consumer stopped');
}

module.exports = { startConsumer, stopConsumer };
