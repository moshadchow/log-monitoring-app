const httpClient = require('../utils/httpClient');
const config = require('../config/env');
const logger = require('../config/logger');

class AuthenticationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'AuthenticationError';
    this.cause = cause;
  }
}

async function login() {
  try {
    const response = await httpClient.post('/api/login', {
      loginId: config.oms.username,
      password: config.oms.password,
      deviceId: config.oms.deviceId,
      mfaKey: config.oms.mfaKey,
      mfaCode: config.oms.mfaCode,
      appType: config.oms.appType,
    });

    const envelope = response.data || {};
    const data = envelope.data || envelope;
    if (!data.accessToken && !data.token) {
      logger.error('OMS login response missing token', { responseData: envelope });
      throw new AuthenticationError('Login response did not contain an access token');
    }

    logger.info('OMS authentication successful');

    return {
      accessToken: data.accessToken || data.token,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    };
  } catch (err) {
    logger.error('OMS authentication failed', {
      error: err.message,
      status: err.response?.status,
      responseData: err.response?.data,
    });
    throw new AuthenticationError('Failed to authenticate with OMS API', err);
  }
}

module.exports = { login, AuthenticationError };
