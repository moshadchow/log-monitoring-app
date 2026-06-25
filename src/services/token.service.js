const httpClient = require('../utils/httpClient');
const authService = require('./auth.service');
const config = require('../config/env');
const logger = require('../config/logger');

const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000;

let state = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
};

let refreshInFlight = null;

function setTokens({ accessToken, refreshToken, expiresIn }) {
  const ttlMs = (expiresIn ? expiresIn * 1000 : DEFAULT_TOKEN_TTL_MS);
  state = {
    accessToken,
    refreshToken: refreshToken || state.refreshToken,
    expiresAt: Date.now() + ttlMs,
  };
}

async function authenticate() {
  const tokens = await authService.login();
  setTokens(tokens);
  return state.accessToken;
}

async function refresh() {
  if (!state.refreshToken) {
    logger.warn('No refresh token available, performing full re-authentication');
    return authenticate();
  }

  try {
    const response = await httpClient.post('/api/refresh-token', {
      refreshToken: state.refreshToken,
    });
    const data = response.data || {};
    if (!data.accessToken && !data.token) {
      throw new Error('Refresh response did not contain an access token');
    }
    setTokens({
      accessToken: data.accessToken || data.token,
      refreshToken: data.refreshToken || state.refreshToken,
      expiresIn: data.expiresIn,
    });
    logger.info('OMS access token refreshed successfully');
    return state.accessToken;
  } catch (err) {
    logger.warn('Token refresh failed, falling back to full re-authentication', {
      error: err.message,
    });
    return authenticate();
  }
}

function isExpiringSoon() {
  return Date.now() >= state.expiresAt - config.tokenRefreshBufferMs;
}

async function getValidAccessToken() {
  if (state.accessToken && !isExpiringSoon()) {
    return state.accessToken;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (state.accessToken ? refresh() : authenticate()).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function getStatus() {
  return {
    hasAccessToken: Boolean(state.accessToken),
    expiresAt: state.expiresAt ? new Date(state.expiresAt).toISOString() : null,
    expiringSoon: isExpiringSoon(),
  };
}

module.exports = { getValidAccessToken, authenticate, getStatus };
