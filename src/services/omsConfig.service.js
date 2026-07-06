const fernet = require('fernet');
const pool = require('../db/pool');
const config = require('../config/env');
const logger = require('../config/logger');

let cached = null;
let cachedAt = 0;
let refreshInFlight = null;

function isStale() {
  return Date.now() - cachedAt >= config.omsConfigCacheTtlMs;
}

function decryptPassword(encryptedPassword) {
  if (!encryptedPassword) {
    throw new Error('Active OMS endpoint encrypted_password is empty');
  }

  const secret = new fernet.Secret(config.appEncryptionKey);
  const token = new fernet.Token({ secret, token: encryptedPassword, ttl: 0 });
  const plain = token.decode();
  if (!plain) {
    throw new Error('Failed to decrypt OMS endpoint password; check APP_ENCRYPTION_KEY');
  }

  return plain;
}

function mapRow(row) {
  return {
    baseUrl: row.base_url,
    username: row.username,
    password: decryptPassword(row.encrypted_password),
    deviceId: row.device_id,
    mfaKey: row.mfa_key || '',
    mfaCode: row.mfa_code || '',
    appType: row.app_type,
  };
}

async function loadFromDb() {
  const [rows] = await pool.query(
    `SELECT *
     FROM oms_endpoints
     WHERE is_active = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [1]
  );

  if (rows.length === 0) {
    throw new Error('No active OMS endpoint row found');
  }

  cached = mapRow(rows[0]);
  cachedAt = Date.now();
  logger.info('OMS config loaded from database');
  return cached;
}

async function getOmsConfig() {
  if (cached && !isStale()) {
    return cached;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = loadFromDb()
    .catch((err) => {
      if (cached) {
        logger.warn('Failed to refresh OMS config from database, serving stale cached config', {
          error: err.message,
        });
        return cached;
      }
      logger.error('Failed to load OMS config from database and no cached config available', {
        error: err.message,
      });
      throw err;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

module.exports = { getOmsConfig };
