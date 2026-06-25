const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled request error', {
    method: req.method,
    path: req.originalUrl,
    error: err.message,
    stack: err.stack,
  });

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
