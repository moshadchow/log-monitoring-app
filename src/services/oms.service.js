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

  try {
    const response = await httpClient.post(
      '/api/logs',
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const body = response.data;
    if (!body || body.success !== true || !Array.isArray(body.data)) {
      throw new OmsApiError('Invalid response shape from OMS logs API');
    }

    return body.data;
  } catch (err) {
    if (err instanceof OmsApiError) {
      logger.error('OMS logs API returned an invalid response', { error: err.message });
      throw err;
    }
    logger.error('Failed to fetch logs from OMS API', { error: err.message });
    throw new OmsApiError('Failed to fetch logs from OMS API', err);
  }
}

module.exports = { fetchLogs, OmsApiError };
