const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('./env');

const SENSITIVE_KEY_PATTERN = /(password|token|authorization|mfa|webhook|secret|credential)/i;

function redactValue(value) {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      value[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redactValue(nestedValue);
    }
  }

  return value;
}

const redactSensitiveMeta = winston.format((info) => redactValue(info));

const fileTransport = new winston.transports.DailyRotateFile({
  dirname: config.logsDir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  level: config.logLevel,
  format: winston.format.combine(redactSensitiveMeta(), winston.format.timestamp(), winston.format.json()),
});

const errorFileTransport = new winston.transports.DailyRotateFile({
  dirname: config.logsDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(redactSensitiveMeta(), winston.format.timestamp(), winston.format.json()),
});

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    redactSensitiveMeta(),
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
  ),
});

const logger = winston.createLogger({
  level: config.logLevel,
  transports: [consoleTransport, fileTransport, errorFileTransport],
  exitOnError: false,
});

module.exports = logger;
