const kafka = require('../config/kafka');
const config = require('../config/config');
const logger = require('../utils/logger');

const producer = kafka.producer();
let connected = false;

async function connectProducer() {
  if (connected) return;
  await producer.connect();
  connected = true;
  logger.info('Kafka producer connected');
}

async function disconnectProducer() {
  if (!connected) return;
  await producer.disconnect();
  connected = false;
  logger.info('Kafka producer disconnected');
}

async function publishFetchRequested(evidence) {
  await connectProducer();
  await producer.send({
    topic: config.kafka.topics.fetchRequested,
    messages: [
      {
        key: String(evidence.id),
        value: JSON.stringify({
          evidenceId: evidence.id,
          studentId: evidence.studentId,
          semester: evidence.semester,
          platform: evidence.platform,
          profileUrl: evidence.profileUrl,
          requestedAt: new Date().toISOString(),
        }),
      },
    ],
  });
  logger.info(`Published fetch-requested for evidence ${evidence.id}`);
}

async function publishFetchCompleted(evidence) {
  await connectProducer();
  await producer.send({
    topic: config.kafka.topics.fetchCompleted,
    messages: [
      {
        key: String(evidence.id),
        value: JSON.stringify({
          evidenceId: evidence.id,
          studentId: evidence.studentId,
          platform: evidence.platform,
          totalProblemsSolved: evidence.totalProblemsSolved,
          sqlProblemsSolved: evidence.sqlProblemsSolved,
          fetchedAt: evidence.fetchedAt,
        }),
      },
    ],
  });
  logger.info(`Published fetch-completed for evidence ${evidence.id}`);
}

async function publishFetchFailed(evidenceId, error) {
  await connectProducer();
  await producer.send({
    topic: config.kafka.topics.fetchFailed,
    messages: [
      {
        key: String(evidenceId),
        value: JSON.stringify({
          evidenceId,
          error: error.message || String(error),
          failedAt: new Date().toISOString(),
        }),
      },
    ],
  });
  logger.info(`Published fetch-failed for evidence ${evidenceId}`);
}

module.exports = {
  connectProducer,
  disconnectProducer,
  publishFetchRequested,
  publishFetchCompleted,
  publishFetchFailed,
};
