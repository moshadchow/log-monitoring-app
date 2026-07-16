const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../config/logger');

const DEFAULT_STATE = {
  lastSeenLogId: null,
  lastExecutionAt: null,
  lastExecutionStatus: null,
  lastNotificationAt: null,
  endpoints: {},
};

const DEFAULT_ENDPOINT_STATE = {
  lastSeenLogId: null,
  lastExecutionAt: null,
  lastExecutionStatus: null,
  lastNotificationAt: null,
};

function ensureStateFile() {
  const dir = path.dirname(config.stateFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(config.stateFilePath)) {
    fs.writeFileSync(config.stateFilePath, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}

function readState() {
  ensureStateFile();
  try {
    const raw = fs.readFileSync(config.stateFilePath, 'utf-8');
    const parsed = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    parsed.endpoints = parsed.endpoints || {};

    if (Object.keys(parsed.endpoints).length === 0 && parsed.lastSeenLogId && config.oms.endpoints[0]) {
      parsed.endpoints[config.oms.endpoints[0]] = {
        ...DEFAULT_ENDPOINT_STATE,
        lastSeenLogId: parsed.lastSeenLogId,
        lastExecutionAt: parsed.lastExecutionAt,
        lastExecutionStatus: parsed.lastExecutionStatus,
        lastNotificationAt: parsed.lastNotificationAt,
      };
    }

    return parsed;
  } catch (err) {
    logger.error('Failed to read state file, falling back to defaults', { error: err.message });
    return { ...DEFAULT_STATE };
  }
}

function writeState(partialState) {
  const current = readState();
  const next = { ...current, ...partialState };
  try {
    fs.writeFileSync(config.stateFilePath, JSON.stringify(next, null, 2));
  } catch (err) {
    logger.error('Failed to write state file', { error: err.message });
  }
  return next;
}

function readEndpointState(endpoint) {
  const state = readState();
  return {
    ...DEFAULT_ENDPOINT_STATE,
    ...(state.endpoints && state.endpoints[endpoint] ? state.endpoints[endpoint] : {}),
  };
}

function writeEndpointState(endpoint, partialState) {
  const current = readState();
  const endpointState = {
    ...DEFAULT_ENDPOINT_STATE,
    ...(current.endpoints && current.endpoints[endpoint] ? current.endpoints[endpoint] : {}),
    ...partialState,
  };
  return writeState({
    endpoints: {
      ...(current.endpoints || {}),
      [endpoint]: endpointState,
    },
    lastExecutionAt: partialState.lastExecutionAt || current.lastExecutionAt,
    lastExecutionStatus: partialState.lastExecutionStatus || current.lastExecutionStatus,
    lastNotificationAt: partialState.lastNotificationAt || current.lastNotificationAt,
  });
}

module.exports = { readState, writeState, readEndpointState, writeEndpointState };
