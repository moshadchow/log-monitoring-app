const path = require('path');
require('dotenv').config();

const REQUIRED_VARS = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'APP_ENCRYPTION_KEY',
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

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  },

  appEncryptionKey: process.env.APP_ENCRYPTION_KEY,

  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
  },

  cronSchedule: process.env.CRON_SCHEDULE || '*/5 * * * *',
  logLevel: process.env.LOG_LEVEL || 'info',

  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 15000,
  tokenRefreshBufferMs: parseInt(process.env.TOKEN_REFRESH_BUFFER_MS, 10) || 60000,
  omsConfigCacheTtlMs: parseInt(process.env.OMS_CONFIG_CACHE_TTL_MS, 10) || 5 * 60 * 1000,

  logsDir: path.join(__dirname, '..', '..', 'logs'),
  stateFilePath: path.join(__dirname, '..', 'storage', 'state.json'),

  appVersion: require('../../package.json').version,
};

module.exports = config;
