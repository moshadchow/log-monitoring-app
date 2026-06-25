const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const tokenService = require('./services/token.service');
const cronJob = require('./jobs/cron.job');

let server = null;

async function start() {
  logger.info('Starting OMS Log Monitoring Service', { env: config.nodeEnv });

  try {
    await tokenService.authenticate();
  } catch (err) {
    logger.error('Initial OMS authentication failed, will retry on first scheduled run', {
      error: err.message,
    });
  }

  cronJob.start();

  server = app.listen(config.port, () => {
    logger.info('HTTP server listening', { port: config.port });
  });
}

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  cronJob.stop();

  if (!server) {
    process.exit(0);
    return;
  }

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.warn('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason && reason.message });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
});

start();
