USE broker_db;

SET @schema_name = DATABASE();

SET @add_encrypted_password = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE oms_endpoints ADD COLUMN encrypted_password TEXT NULL AFTER username',
    'SELECT ''oms_endpoints.encrypted_password already exists'''
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oms_endpoints'
    AND COLUMN_NAME = 'encrypted_password'
);
PREPARE stmt FROM @add_encrypted_password;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @needs_is_active = (
  SELECT COUNT(*) = 0
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oms_endpoints'
    AND COLUMN_NAME = 'is_active'
);

SET @add_is_active = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE oms_endpoints ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER app_type',
    'SELECT ''oms_endpoints.is_active already exists'''
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oms_endpoints'
    AND COLUMN_NAME = 'is_active'
);
PREPARE stmt FROM @add_is_active;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_name_column = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oms_endpoints'
    AND COLUMN_NAME = 'name'
);

SET @preserve_primary_endpoint = IF(
  @needs_is_active AND @has_name_column > 0,
  'UPDATE oms_endpoints SET is_active = CASE WHEN name = ''primary'' THEN 1 ELSE 0 END',
  'SELECT ''leaving is_active values unchanged'''
);
PREPARE stmt FROM @preserve_primary_endpoint;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_mfa_key = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE oms_endpoints ADD COLUMN mfa_key VARCHAR(255) NULL AFTER device_id',
    'SELECT ''oms_endpoints.mfa_key already exists'''
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oms_endpoints'
    AND COLUMN_NAME = 'mfa_key'
);
PREPARE stmt FROM @add_mfa_key;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_mfa_code = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE oms_endpoints ADD COLUMN mfa_code VARCHAR(255) NULL AFTER mfa_key',
    'SELECT ''oms_endpoints.mfa_code already exists'''
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oms_endpoints'
    AND COLUMN_NAME = 'mfa_code'
);
PREPARE stmt FROM @add_mfa_code;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_description = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE oms_endpoints ADD COLUMN description VARCHAR(500) NULL AFTER is_active',
    'SELECT ''oms_endpoints.description already exists'''
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oms_endpoints'
    AND COLUMN_NAME = 'description'
);
PREPARE stmt FROM @add_description;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_active_index = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX idx_oms_endpoints_active_updated ON oms_endpoints (is_active, updated_at)',
    'SELECT ''idx_oms_endpoints_active_updated already exists'''
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oms_endpoints'
    AND INDEX_NAME = 'idx_oms_endpoints_active_updated'
);
PREPARE stmt FROM @add_active_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
