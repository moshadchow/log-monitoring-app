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

function buildMessage(log, context = {}) {
  const timestamp = log.dateTimeLocal || log.timestamp || 'N/A';
  const message = truncate(escapeMarkdown(log.message), 850);
  const exception = truncate(escapeMarkdown(log.exception), 850);
  const endpoint = context.endpoint || log.omsEndpoint || 'N/A';

  const content = [
    '**OMS Error Alert**',
    '',
    `**OMS Server** : ${endpoint}`,
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

async function sendErrorNotification(log, context = {}) {
  const payload = buildMessage(log, context);

  try {
    await axios.post(config.discord.webhookUrl, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    logger.info('Discord notification sent', { logId: log.id, endpoint: context.endpoint });
  } catch (err) {
    logger.error('Failed to send Discord notification', {
      logId: log.id,
      endpoint: context.endpoint,
      error: err.message,
    });
  }
}

module.exports = { sendErrorNotification, buildMessage };
