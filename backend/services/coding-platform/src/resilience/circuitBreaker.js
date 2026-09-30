const CircuitBreaker = require('opossum');
const config = require('../config/config');
const logger = require('../utils/logger');

const breakers = new Map();

function createBreaker(name, fn) {
  if (breakers.has(name)) return breakers.get(name);

  const breaker = new CircuitBreaker(fn, {
    errorThresholdPercentage: config.circuitBreaker.errorThresholdPercentage,
    resetTimeout: config.circuitBreaker.resetTimeout,
    timeout: config.circuitBreaker.timeout,
    name,
  });

  breaker.on('open', () => logger.warn(`Circuit breaker OPEN: ${name}`));
  breaker.on('halfOpen', () => logger.info(`Circuit breaker HALF-OPEN: ${name}`));
  breaker.on('close', () => logger.info(`Circuit breaker CLOSED: ${name}`));
  breaker.on('fallback', () => logger.warn(`Circuit breaker FALLBACK: ${name}`));

  breakers.set(name, breaker);
  return breaker;
}

function getBreaker(name) {
  return breakers.get(name);
}

function getAllBreakers() {
  return Object.fromEntries(breakers);
}

module.exports = { createBreaker, getBreaker, getAllBreakers };
