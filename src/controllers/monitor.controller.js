const config = require('../config/env');
const cronJob = require('../jobs/cron.job');
const tokenService = require('../services/token.service');
const stateStore = require('../utils/stateStore');

function getStatus(req, res) {
  const state = stateStore.readState();
  const endpoints = config.oms.endpoints.reduce((acc, endpoint) => {
    acc[endpoint] = {
      state: stateStore.readEndpointState(endpoint),
      token: tokenService.getStatus(endpoint),
    };
    return acc;
  }, {});

  res.json({
    success: true,
    scheduler: cronJob.getStatus(),
    token: tokenService.getStatus(config.oms.baseUrl),
    endpoints,
    lastExecutionAt: state.lastExecutionAt,
    lastExecutionStatus: state.lastExecutionStatus,
    lastNotificationAt: state.lastNotificationAt,
  });
}

async function runNow(req, res) {
  const result = await cronJob.triggerNow();
  res.json({ success: true, result });
}

function getVersion(req, res) {
  res.json({ success: true, version: config.appVersion });
}

module.exports = { getStatus, runNow, getVersion };
