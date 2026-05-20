-- patch-002-notification-feishu-message-id.sql
-- 目的：为站内通知补充飞书消息ID持久化字段，支持后续就地更新原卡片
-- 可重入：已存在字段时跳过

SET @db_name = DATABASE();

SET @sql = (
	SELECT IF(
		EXISTS (
			SELECT 1
			FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = @db_name
				AND TABLE_NAME = 'doc_notifications'
				AND COLUMN_NAME = 'feishu_message_id'
		),
		'SELECT 1',
		'ALTER TABLE doc_notifications ADD COLUMN feishu_message_id VARCHAR(100) NULL COMMENT ''飞书消息ID，用于原卡更新'' AFTER biz_id'
	)
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
	SELECT IF(
		EXISTS (
			SELECT 1
			FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = @db_name
				AND TABLE_NAME = 'doc_notifications'
				AND COLUMN_NAME = 'feishu_open_message_id'
		),
		'SELECT 1',
		'ALTER TABLE doc_notifications ADD COLUMN feishu_open_message_id VARCHAR(100) NULL COMMENT ''飞书开放消息ID'' AFTER feishu_message_id'
	)
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
