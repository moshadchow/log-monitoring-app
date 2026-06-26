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

async function fetchLogs() {
  const accessToken = await tokenService.getValidAccessToken();

  const now = new Date();
  // const from = new Date(now.getTime() - 5 * 60 * 1000);
  const from = new Date(now);
  from.setDate(from.getDate() - 1);
  const fmt = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  try {
    const response = await httpClient.get('/api/logs', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        'Filter.logType': 'WorkerLog',
        'Filter.fromDateTimeLocal': fmt(from),
        'Filter.toDateTimeLocal': fmt(now),
        'Paging.page': 1,
        'Paging.size': 50,
      },
    });

    const body = response.data;
    if (!body || body.success !== true || !Array.isArray(body.data)) {
      logger.error('OMS logs API returned unexpected shape', { responseData: body });
      throw new OmsApiError('Invalid response shape from OMS logs API');
    }

    return body.data;
  } catch (err) {
    const envelope = err.response?.data || {};
    const data = envelope.data || envelope;
    if (err instanceof OmsApiError) {
      logger.error('OMS logs API returned an invalid response', { error: err.message });
      throw err;
    }
    logger.error('Failed to fetch logs from OMS API', {
      error: err.message,
      code: err.code,
      status: err.response?.status,
      responseData: err.response?.data,
    });
    throw new OmsApiError('Failed to fetch logs from OMS API', err);
  }
}

module.exports = { fetchLogs, OmsApiError };
