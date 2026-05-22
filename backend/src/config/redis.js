'use strict';

/**
 * Redis client — optional, graceful fallback.
 *
 * Set REDIS_URL in .env for production (e.g. redis://redis:6379).
 * If REDIS_URL is absent the module exports { available: false }
 * and all Redis-dependent features (Socket.IO adapter, throttle)
 * fall back to in-process equivalents.
 */

const Redis = require('ioredis');
const logger = require('./logger');

const REDIS_URL = process.env.REDIS_URL;

let pubClient = null;
let subClient = null;
let available = false;

if (REDIS_URL) {
  try {
    pubClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,   // required by BullMQ / ioredis
      enableReadyCheck: false,
      lazyConnect: false,
    });

    subClient = pubClient.duplicate();

    pubClient.on('connect', () => {
      logger.info({ message: 'Redis pubClient connected', url: REDIS_URL });
      available = true;
    });

    pubClient.on('error', (err) => {
      logger.warn({ message: 'Redis pubClient error', error: err.message });
    });

    subClient.on('error', (err) => {
      logger.warn({ message: 'Redis subClient error', error: err.message });
    });

  } catch (err) {
    logger.warn({ message: 'Redis initialisation failed — falling back to in-memory', error: err.message });
  }
} else {
  logger.info({ message: 'REDIS_URL not set — Redis disabled (in-memory fallback active)' });
}

module.exports = { pubClient, subClient, available: () => available };
