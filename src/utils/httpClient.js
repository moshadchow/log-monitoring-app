const axios = require('axios');
const axiosRetry = require('axios-retry').default || require('axios-retry');
const config = require('../config/env');
const logger = require('../config/logger');
const omsConfigService = require('../services/omsConfig.service');

const httpClient = axios.create({
  timeout: config.requestTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use(async (requestConfig) => {
  const omsConfig = await omsConfigService.getOmsConfig();
  requestConfig.baseURL = omsConfig.baseUrl;
  return requestConfig;
});

axiosRetry(httpClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    const status = error.response && error.response.status;
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.code === 'ECONNABORTED' ||
      status === 429 ||
      (status >= 500 && status < 600)
    );
  },
  onRetry: (retryCount, error, requestConfig) => {
    logger.warn('Retrying OMS request', {
      url: requestConfig.url,
      attempt: retryCount,
      error: error.message,
    });
  },
});

module.exports = httpClient;
