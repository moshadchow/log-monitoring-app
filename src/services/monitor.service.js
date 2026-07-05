const omsService = require('./oms.service');
const discordService = require('./discord.service');
const stateStore = require('../utils/stateStore');
const logger = require('../config/logger');
const ignorePatterns = require('../config/ignorePatterns');
const { isIgnoredLog } = require('../utils/logFilter');

async function runCycle() {
  const startedAt = Date.now();
  try {
    const logs = await omsService.fetchAllLogs();

    const errorLogs = logs
      .filter((log) => log.level === 'ERROR')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const notifiableLogs = errorLogs.filter((log) => !isIgnoredLog(log, ignorePatterns));

    if (notifiableLogs.length === 0) {
      logger.info('Monitoring cycle complete: no notifiable error logs found', {
        totalErrorLogs: errorLogs.length,
        ignoredCount: errorLogs.length - notifiableLogs.length,
      });
      stateStore.writeState({
        lastExecutionAt: new Date().toISOString(),
        lastExecutionStatus: 'success',
      });
      return { notified: false };
    }

    const latest = notifiableLogs[0];
    const { lastSeenLogId } = stateStore.readState();

    if (latest.id === lastSeenLogId) {
      logger.info('Monitoring cycle complete: latest error already notified', {
        logId: latest.id,
      });
      stateStore.writeState({
        lastExecutionAt: new Date().toISOString(),
        lastExecutionStatus: 'success',
      });
      return { notified: false };
    }

    await discordService.sendErrorNotification(latest);

    stateStore.writeState({
      lastSeenLogId: latest.id,
      lastExecutionAt: new Date().toISOString(),
      lastExecutionStatus: 'success',
      lastNotificationAt: new Date().toISOString(),
    });

    logger.info('Monitoring cycle complete: new error notified', {
      logId: latest.id,
      durationMs: Date.now() - startedAt,
    });

    return { notified: true, logId: latest.id };
  } catch (err) {
    logger.error('Monitoring cycle failed', { error: err.message });
    stateStore.writeState({
      lastExecutionAt: new Date().toISOString(),
      lastExecutionStatus: 'failed',
    });
    return { notified: false, error: err.message };
  }
}

module.exports = { runCycle };
