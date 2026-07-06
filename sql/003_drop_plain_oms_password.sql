USE broker_db;

SET @schema_name = DATABASE();

SET @drop_plain_password = (
  SELECT IF(
    COUNT(*) = 1,
    'ALTER TABLE oms_endpoints DROP COLUMN password',
    'SELECT ''oms_endpoints.password does not exist'''
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oms_endpoints'
    AND COLUMN_NAME = 'password'
);
PREPARE stmt FROM @drop_plain_password;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
