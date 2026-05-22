const logger = require('../config/logger');

class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'APP_ERROR';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message, code, isOperational } = err;

  // Log the error
  if (statusCode >= 500 || !isOperational) {
    logger.error({
      message: err.message,
      stack: err.stack,
      statusCode,
      code,
      path: req.path,
      method: req.method,
      requestId: req.requestId,
      userId: req.user?.id,
    });
  } else {
    logger.warn({
      message: err.message,
      statusCode,
      code,
      path: req.path,
      method: req.method,
      requestId: req.requestId,
      userId: req.user?.id,
    });
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && !isOperational) {
    message = 'An unexpected error occurred';
    code = 'INTERNAL_SERVER_ERROR';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: code || 'ERROR',
    },
  });
};

const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.path} not found`, 404, 'NOT_FOUND'));
};

module.exports = { errorHandler, notFound, AppError };
