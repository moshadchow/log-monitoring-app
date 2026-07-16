const axios = require('axios');
const axiosRetry = require('axios-retry').default || require('axios-retry');
const config = require('../config/env');
const logger = require('../config/logger');

const clients = new Map();

function createClient(baseURL) {
  const httpClient = axios.create({
    baseURL,
    timeout: config.requestTimeoutMs,
    headers: { 'Content-Type': 'application/json' },
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
        endpoint: baseURL,
        url: requestConfig.url,
        attempt: retryCount,
        error: error.message,
      });
    },
  });

  return httpClient;
}

function getClient(baseURL = config.oms.baseUrl) {
  if (!clients.has(baseURL)) {
    clients.set(baseURL, createClient(baseURL));
  }
  return clients.get(baseURL);
}

module.exports = { getClient };
