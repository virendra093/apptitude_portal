-- Check if ideal_time column exists, if not add it
SET @dbname = 'apptitude_portal';
SET @tablename = 'questions';
SET @columnname = 'ideal_time';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE questions ADD COLUMN ideal_time INT NOT NULL DEFAULT 60 COMMENT 'Ideal time in seconds to answer this question'"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Update ideal_time based on question length
UPDATE questions 
SET ideal_time = 
  CASE 
    WHEN LENGTH(question_text) <= 100 THEN 30
    WHEN LENGTH(question_text) <= 200 THEN 45
    WHEN LENGTH(question_text) <= 300 THEN 60
    WHEN LENGTH(question_text) <= 400 THEN 75
    ELSE 90
  END; 