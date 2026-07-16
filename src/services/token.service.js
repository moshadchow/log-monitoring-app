const { getClient } = require('../utils/httpClient');
const authService = require('./auth.service');
const config = require('../config/env');
const logger = require('../config/logger');

const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000;

const states = new Map();
const refreshInFlight = new Map();

function createState() {
  return {
    accessToken: null,
    refreshToken: null,
    expiresAt: 0,
  };
}

function getState(endpoint = config.oms.baseUrl) {
  if (!states.has(endpoint)) {
    states.set(endpoint, createState());
  }
  return states.get(endpoint);
}

function setTokens(endpoint, { accessToken, refreshToken, expiresIn }) {
  const state = getState(endpoint);
  const ttlMs = (expiresIn ? expiresIn * 1000 : DEFAULT_TOKEN_TTL_MS);
  const next = {
    accessToken,
    refreshToken: refreshToken || state.refreshToken,
    expiresAt: Date.now() + ttlMs,
  };
  states.set(endpoint, next);
}

async function authenticate(endpoint = config.oms.baseUrl) {
  const tokens = await authService.login(endpoint);
  setTokens(endpoint, tokens);
  return getState(endpoint).accessToken;
}

async function refresh(endpoint = config.oms.baseUrl) {
  const state = getState(endpoint);
  if (!state.refreshToken) {
    logger.warn('No refresh token available, performing full re-authentication', { endpoint });
    return authenticate(endpoint);
  }

  try {
    const httpClient = getClient(endpoint);
    const response = await httpClient.post('/api/refresh-token', {
      refreshToken: state.refreshToken,
    });
    const envelope = response.data || {};
    const data = envelope.data || envelope;
    if (!data.accessToken && !data.token) {
      throw new Error('Refresh response did not contain an access token');
    }
    setTokens(endpoint, {
      accessToken: data.accessToken || data.token,
      refreshToken: data.refreshToken || state.refreshToken,
      expiresIn: data.expiresIn,
    });
    logger.info('OMS access token refreshed successfully', { endpoint });
    return getState(endpoint).accessToken;
  } catch (err) {
    logger.warn('Token refresh failed, falling back to full re-authentication', {
      endpoint,
      error: err.message,
    });
    return authenticate(endpoint);
  }
}

function isExpiringSoon(endpoint = config.oms.baseUrl) {
  const state = getState(endpoint);
  return Date.now() >= state.expiresAt - config.tokenRefreshBufferMs;
}

async function getValidAccessToken(endpoint = config.oms.baseUrl) {
  const state = getState(endpoint);
  if (state.accessToken && !isExpiringSoon(endpoint)) {
    return state.accessToken;
  }

  if (refreshInFlight.has(endpoint)) {
    return refreshInFlight.get(endpoint);
  }

  const promise = (state.accessToken ? refresh(endpoint) : authenticate(endpoint)).finally(() => {
    refreshInFlight.delete(endpoint);
  });
  refreshInFlight.set(endpoint, promise);

  return promise;
}

function getStatus(endpoint = config.oms.baseUrl) {
  const state = getState(endpoint);
  return {
    hasAccessToken: Boolean(state.accessToken),
    expiresAt: state.expiresAt ? new Date(state.expiresAt).toISOString() : null,
    expiringSoon: isExpiringSoon(endpoint),
  };
}

module.exports = { getValidAccessToken, authenticate, getStatus };
