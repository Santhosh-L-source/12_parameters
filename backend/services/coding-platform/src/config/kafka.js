const { Kafka } = require('kafkajs');
const config = require('./config');

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  connectionTimeout: 3000,
  retry: {
    initialRetryTime: 300,
    retries: 2,
  },
});

module.exports = kafka;
