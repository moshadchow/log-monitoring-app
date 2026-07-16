const { getClient } = require('../utils/httpClient');
const tokenService = require('./token.service');
const config = require('../config/env');
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

async function fetchLogs(logType, { endpoint = config.oms.baseUrl, retryOn401 = true } = {}) {
  const accessToken = await tokenService.getValidAccessToken(endpoint);
  const httpClient = getClient(endpoint);

  try {
    const response = await httpClient.get('/api/logs', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: buildParams(logType),
    });

    const body = response.data;
    if (!body || body.success !== true || !Array.isArray(body.data)) {
      logger.error('OMS logs API returned unexpected shape', { endpoint, logType, responseData: body });
      throw new OmsApiError('Invalid response shape from OMS logs API');
    }

    return body.data;
  } catch (err) {
    if (err.response?.status === 401 && retryOn401) {
      logger.warn('OMS session invalidated, re-authenticating and retrying', {
        endpoint,
        logType,
        responseData: err.response?.data,
      });
      await tokenService.authenticate(endpoint);
      return fetchLogs(logType, { endpoint, retryOn401: false });
    }

    if (err instanceof OmsApiError) {
      logger.error('OMS logs API returned an invalid response', { endpoint, logType, error: err.message });
      throw err;
    }
    logger.error('Failed to fetch logs from OMS API', {
      endpoint,
      logType,
      error: err.message,
      code: err.code,
      status: err.response?.status,
      responseData: err.response?.data,
    });
    throw new OmsApiError('Failed to fetch logs from OMS API', err);
  }
}

async function fetchAllLogs(endpoint = config.oms.baseUrl) {
  const [workerResult, apiResult] = await Promise.allSettled([
    fetchLogs('WorkerLog', { endpoint }),
    fetchLogs('ApiLog', { endpoint }),
  ]);

  if (workerResult.status === 'rejected' && apiResult.status === 'rejected') {
    logger.error('Failed to fetch logs from both WorkerLog and ApiLog sources', { endpoint });
    throw new OmsApiError('Failed to fetch logs from OMS API', apiResult.reason);
  }

  const workerLogs = workerResult.status === 'fulfilled' ? workerResult.value : [];
  const apiLogs = apiResult.status === 'fulfilled' ? apiResult.value : [];

  return [...workerLogs, ...apiLogs];
}

module.exports = { fetchLogs, fetchAllLogs, OmsApiError };
