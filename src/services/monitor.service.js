const omsService = require('./oms.service');
const discordService = require('./discord.service');
const stateStore = require('../utils/stateStore');
const config = require('../config/env');
const logger = require('../config/logger');
const ignorePatterns = require('../config/ignorePatterns');
const { isIgnoredLog } = require('../utils/logFilter');

async function runCycle() {
  const results = await Promise.allSettled(config.oms.endpoints.map((endpoint) => runEndpointCycle(endpoint)));
  const endpoints = results.map((result, index) => {
    const endpoint = config.oms.endpoints[index];
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      endpoint,
      notified: false,
      error: result.reason.message,
    };
  });

  const failedCount = endpoints.filter((result) => result.error).length;
  const notifiedCount = endpoints.filter((result) => result.notified).length;
  const aggregateStatus = failedCount === endpoints.length
    ? 'failed'
    : failedCount > 0
      ? 'partial_failed'
      : 'success';

  stateStore.writeState({
    lastExecutionAt: new Date().toISOString(),
    lastExecutionStatus: aggregateStatus,
    ...(notifiedCount > 0 ? { lastNotificationAt: new Date().toISOString() } : {}),
  });

  logger.info('Monitoring cycle complete for all endpoints', {
    endpointCount: endpoints.length,
    failedCount,
    notifiedCount,
    status: aggregateStatus,
  });

  return {
    notified: notifiedCount > 0,
    notifiedCount,
    failedCount,
    endpoints,
  };
}

async function runEndpointCycle(endpoint) {
  const startedAt = Date.now();
  try {
    logger.info('Processing OMS endpoint', { endpoint });
    const logs = await omsService.fetchAllLogs(endpoint);

    const errorLogs = logs
      .filter((log) => log.level === 'ERROR')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    errorLogs.forEach((log) => {
      logger.debug({ endpoint, message: log.message, ignored: isIgnoredLog(log, ignorePatterns) });
    });

    const notifiableLogs = errorLogs.filter((log) => !isIgnoredLog(log, ignorePatterns));

    logger.debug('Ignore filter applied', {
      endpoint,
      retrievedCount: logs.length,
      totalErrorLogs: errorLogs.length,
      ignoredCount: errorLogs.length - notifiableLogs.length,
    });

    if (notifiableLogs.length === 0) {
      logger.info('Monitoring cycle complete: no notifiable error logs found', {
        endpoint,
        retrievedCount: logs.length,
        totalErrorLogs: errorLogs.length,
        ignoredCount: errorLogs.length - notifiableLogs.length,
      });
      stateStore.writeEndpointState(endpoint, {
        lastExecutionAt: new Date().toISOString(),
        lastExecutionStatus: 'success',
      });
      return {
        endpoint,
        notified: false,
        retrievedCount: logs.length,
        ignoredCount: errorLogs.length - notifiableLogs.length,
      };
    }

    const latest = notifiableLogs[0];
    const { lastSeenLogId } = stateStore.readEndpointState(endpoint);

    if (latest.id === lastSeenLogId) {
      logger.info('Monitoring cycle complete: latest error already notified', {
        endpoint,
        logId: latest.id,
      });
      stateStore.writeEndpointState(endpoint, {
        lastExecutionAt: new Date().toISOString(),
        lastExecutionStatus: 'success',
      });
      return { endpoint, notified: false, logId: latest.id, retrievedCount: logs.length };
    }

    await discordService.sendErrorNotification(latest, { endpoint });

    stateStore.writeEndpointState(endpoint, {
      lastSeenLogId: latest.id,
      lastExecutionAt: new Date().toISOString(),
      lastExecutionStatus: 'success',
      lastNotificationAt: new Date().toISOString(),
    });

    logger.info('Monitoring cycle complete: new error notified', {
      endpoint,
      logId: latest.id,
      durationMs: Date.now() - startedAt,
    });

    return { endpoint, notified: true, logId: latest.id, retrievedCount: logs.length };
  } catch (err) {
    logger.error('Monitoring cycle failed', { endpoint, error: err.message });
    stateStore.writeEndpointState(endpoint, {
      lastExecutionAt: new Date().toISOString(),
      lastExecutionStatus: 'failed',
    });
    return { endpoint, notified: false, error: err.message };
  }
}

module.exports = { runCycle };
