const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../config/logger');

const DEFAULT_STATE = {
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
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
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

module.exports = { readState, writeState };
