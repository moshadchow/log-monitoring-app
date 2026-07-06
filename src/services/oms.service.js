const httpClient = require('../utils/httpClient');
const tokenService = require('./token.service');
const logger = require('../config/logger');

class OmsApiError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'OmsApiError';
    this.cause = cause;
  }
}

function buildParams(logType) {
  const now = new Date();
  const from = new Date(now.getTime() - 5 * 60 * 1000);
  const fmt = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return {
    'Filter.logType': logType,
    'Filter.level': 'ERROR',
    'Filter.fromDateTimeLocal': fmt(from),
    'Filter.toDateTimeLocal': fmt(now),
    'Paging.page': 1,
    'Paging.size': 50,
  };
}

async function fetchLogs(logType, { retryOn401 = true } = {}) {
  const accessToken = await tokenService.getValidAccessToken();

  try {
    const response = await httpClient.get('/api/logs', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: buildParams(logType),
    });

    const body = response.data;
    if (!body || body.success !== true || !Array.isArray(body.data)) {
      logger.error('OMS logs API returned unexpected shape', { logType, status: response.status });
      throw new OmsApiError('Invalid response shape from OMS logs API');
    }

    return body.data;
  } catch (err) {
    if (err.response?.status === 401 && retryOn401) {
      logger.warn('OMS session invalidated, re-authenticating and retrying', {
        logType,
        status: err.response.status,
      });
      await tokenService.authenticate();
      return fetchLogs(logType, { retryOn401: false });
    }

    if (err instanceof OmsApiError) {
      logger.error('OMS logs API returned an invalid response', { logType, error: err.message });
      throw err;
    }
    logger.error('Failed to fetch logs from OMS API', {
      logType,
      error: err.message,
      code: err.code,
      status: err.response?.status,
    });
    throw new OmsApiError('Failed to fetch logs from OMS API', err);
  }
}

async function fetchAllLogs() {
  const [workerResult, apiResult] = await Promise.allSettled([
    fetchLogs('WorkerLog'),
    fetchLogs('ApiLog'),
  ]);

  if (workerResult.status === 'rejected' && apiResult.status === 'rejected') {
    logger.error('Failed to fetch logs from both WorkerLog and ApiLog sources');
    throw new OmsApiError('Failed to fetch logs from OMS API', apiResult.reason);
  }

  const workerLogs = workerResult.status === 'fulfilled' ? workerResult.value : [];
  const apiLogs = apiResult.status === 'fulfilled' ? apiResult.value : [];

  return [...workerLogs, ...apiLogs];
}

module.exports = { fetchLogs, fetchAllLogs, OmsApiError };
