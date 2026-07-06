CREATE DATABASE IF NOT EXISTS broker_db;

USE broker_db;

CREATE TABLE IF NOT EXISTS oms_endpoints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  base_url VARCHAR(2048) NOT NULL,
  username VARCHAR(255) NOT NULL,
  encrypted_password TEXT NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  mfa_key VARCHAR(255) NULL,
  mfa_code VARCHAR(255) NULL,
  app_type INT NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  description VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_oms_endpoints_active_updated (is_active, updated_at)
);

-- Insert or update encrypted credentials directly in MySQL, for example:
-- INSERT INTO oms_endpoints (
--   base_url, username, encrypted_password, device_id, mfa_key, mfa_code, app_type, is_active, description
-- ) VALUES (
--   'https://prod-oms-api-1.xfltrade.com:20121',
--   'xfl_support_moshad',
--   'replace-with-fernet-token',
--   'my-device-id-01',
--   '',
--   '',
--   1,
--   1,
--   'Production OMS endpoint'
-- );
