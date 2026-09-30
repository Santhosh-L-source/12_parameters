const logger = require('../utils/logger');

const breakers = new Map();

function createBreaker(name, fn) {
  if (breakers.has(name)) return breakers.get(name);

  const breaker = {
    fire: async (...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        logger.warn(`Execution failed for circuit breaker [${name}]: ${err.message}`);
        throw err;
      }
    },
    on: () => {},
  };

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
