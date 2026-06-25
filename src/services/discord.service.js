const axios = require('axios');
const config = require('../config/env');
const logger = require('../config/logger');

function escapeMarkdown(text) {
  if (!text) return 'N/A';
  return String(text).replace(/([_*~`|])/g, '\\$1');
}

function truncate(text, maxLength) {
  if (!text) return 'N/A';
  const str = String(text);
  return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
}

function buildMessage(log) {
  const timestamp = log.dateTimeLocal || log.timestamp || 'N/A';
  const message = truncate(escapeMarkdown(log.message), 1000);
  const exception = truncate(escapeMarkdown(log.exception), 1000);

  const content = [
    '🚨 **OMS Error Alert**',
    '',
    `**Timestamp** : ${timestamp}`,
    `**Level**     : ${log.level || 'ERROR'}`,
    `**Server**    : ${log.server || 'N/A'}`,
    '',
    '**Message**',
    '```',
    message,
    '```',
    '',
    '**Exception**',
    '```',
    exception,
    '```',
  ].join('\n');

  return { content };
}

async function sendErrorNotification(log) {
  const payload = buildMessage(log);

  try {
    await axios.post(config.discord.webhookUrl, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    logger.info('Discord notification sent', { logId: log.id });
  } catch (err) {
    logger.error('Failed to send Discord notification', {
      logId: log.id,
      error: err.message,
    });
  }
}

module.exports = { sendErrorNotification, buildMessage };
