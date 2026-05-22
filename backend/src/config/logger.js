const winston = require('winston');
const path = require('path');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const transports = [
  new winston.transports.Console({
    format:
      process.env.NODE_ENV === 'development'
        ? combine(colorize(), simple())
        : json(),
  }),
];

// In production, also write to files under the app working directory (/app/logs in Docker)
if (process.env.NODE_ENV === 'production') {
  const logDir = path.join(process.cwd(), 'logs');
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 20 * 1024 * 1024, // 20 MB
      maxFiles: 10,
      format: combine(timestamp(), errors({ stack: true }), json()),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'kripanidhi-legal-api' },
  transports,
});

module.exports = logger;
