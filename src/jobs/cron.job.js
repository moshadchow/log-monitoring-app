const cron = require('node-cron');
const config = require('../config/env');
const logger = require('../config/logger');
const monitorService = require('../services/monitor.service');

let isRunning = false;
let task = null;

async function executeGuarded() {
  if (isRunning) {
    logger.warn('Skipping scheduled run: previous monitoring cycle still in progress');
    return { skipped: true };
  }
  isRunning = true;
  try {
    return await monitorService.runCycle();
  } finally {
    isRunning = false;
  }
}

function start() {
  if (!cron.validate(config.cronSchedule)) {
    throw new Error(`Invalid CRON_SCHEDULE expression: ${config.cronSchedule}`);
  }

  task = cron.schedule(config.cronSchedule, executeGuarded);
  logger.info('Cron scheduler started', { schedule: config.cronSchedule });
  return task;
}

function stop() {
  if (task) {
    task.stop();
    logger.info('Cron scheduler stopped');
  }
}

function getStatus() {
  return {
    schedule: config.cronSchedule,
    isRunning,
  };
}

function triggerNow() {
  return executeGuarded();
}

module.exports = { start, stop, getStatus, triggerNow };
