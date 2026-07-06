const httpClient = require('../utils/httpClient');
const omsConfigService = require('./omsConfig.service');
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
    const omsConfig = await omsConfigService.getOmsConfig();
    const response = await httpClient.post('/api/login', {
      loginId: omsConfig.username,
      password: omsConfig.password,
      deviceId: omsConfig.deviceId,
      mfaKey: omsConfig.mfaKey,
      mfaCode: omsConfig.mfaCode,
      appType: omsConfig.appType,
    });

    const envelope = response.data || {};
    const data = envelope.data || envelope;
    if (!data.accessToken && !data.token) {
      logger.error('OMS login response missing token', { status: response.status });
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
    });
    throw new AuthenticationError('Failed to authenticate with OMS API', err);
  }
}

module.exports = { login, AuthenticationError };
