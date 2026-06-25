const path = require('path');
require('dotenv').config();

const REQUIRED_VARS = [
  'OMS_BASE_URL',
  'OMS_USERNAME',
  'OMS_PASSWORD',
  'OMS_DEVICE_ID',
  'DISCORD_WEBHOOK_URL',
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  oms: {
    baseUrl: process.env.OMS_BASE_URL,
    username: process.env.OMS_USERNAME,
    password: process.env.OMS_PASSWORD,
    deviceId: process.env.OMS_DEVICE_ID,
    mfaKey: process.env.OMS_MFA_KEY || '',
    mfaCode: process.env.OMS_MFA_CODE || '',
    appType: parseInt(process.env.OMS_APP_TYPE, 10) || 1,
  },

  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
  },

  cronSchedule: process.env.CRON_SCHEDULE || '*/5 * * * *',
  logLevel: process.env.LOG_LEVEL || 'info',

  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 15000,
  tokenRefreshBufferMs: parseInt(process.env.TOKEN_REFRESH_BUFFER_MS, 10) || 60000,

  logsDir: path.join(__dirname, '..', '..', 'logs'),
  stateFilePath: path.join(__dirname, '..', 'storage', 'state.json'),

  appVersion: require('../../package.json').version,
};

module.exports = config;
