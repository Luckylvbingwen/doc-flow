-- =============================================================
-- patch-003-recycle-bin.sql
-- 回收站模块：doc_documents 补 deleted_by_user_id 字段 + 权限码 + 种子
-- 执行方式：
--   老库增量执行此 patch
--   新建库直接走 doc.sql + rbac.sql + doc_seed.sql（已同步）
-- 依赖：doc_users / doc_documents / sys_permissions / sys_roles / sys_role_permissions
-- =============================================================

USE docflow;
SET NAMES utf8mb4;
-- 文档 ↔ 版本互为外键（current_version_id / document_id），种子阶段需要短暂关闭 FK
-- 与 doc_seed.sql 的做法一致
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------
-- 1. doc_documents 增补删除人字段 + 索引 + 外键
-- ---------------------------------------------------------
SET @col_exists = (
	SELECT COUNT(*) FROM information_schema.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME   = 'doc_documents'
	  AND COLUMN_NAME  = 'deleted_by_user_id'
);
SET @sql = IF(@col_exists = 0,
	'ALTER TABLE doc_documents
		ADD COLUMN deleted_by_user_id BIGINT UNSIGNED DEFAULT NULL COMMENT ''删除人（软删操作人）'' AFTER deleted_at_real,
		ADD KEY idx_deleted_by (deleted_by_user_id, deleted_at_real),
		ADD CONSTRAINT fk_documents_deleted_by FOREIGN KEY (deleted_by_user_id) REFERENCES doc_users(id)',
	'SELECT ''column deleted_by_user_id already exists, skip'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------
-- 2. 新增 3 个回收站权限码
-- ---------------------------------------------------------
INSERT INTO sys_permissions (code, name, module, description, sort_order) VALUES
	('recycle:read',    '查看回收站', 'recycle', '查看回收站列表',       1000),
	('recycle:restore', '恢复文件',   'recycle', '从回收站恢复文件',     1001),
	('recycle:delete',  '永久删除',   'recycle', '从回收站永久删除文件', 1002)
ON DUPLICATE KEY UPDATE
	name = VALUES(name), module = VALUES(module), description = VALUES(description);

-- ---------------------------------------------------------
-- 3. 授权：super_admin / company_admin / dept_head / pl_head
--    INSERT IGNORE 兜底重复执行
-- ---------------------------------------------------------
INSERT IGNORE INTO sys_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM sys_roles r
CROSS JOIN sys_permissions p
WHERE r.code IN ('super_admin', 'company_admin', 'dept_head', 'pl_head')
  AND p.code IN ('recycle:read', 'recycle:restore', 'recycle:delete');

-- ---------------------------------------------------------
-- 4. 软删文档种子（5 条，覆盖不同组 / 删除人 / 删除时间）
--    id 50005~50009 承接现有 50001~50004
-- ---------------------------------------------------------
INSERT INTO doc_documents (
	id, group_id, owner_user_id, title, ext, status, source_doc_id, current_version_id,
	deleted_at_real, deleted_by_user_id,
	created_by, updated_by, created_at, updated_at, deleted_at
) VALUES
	(50005, 40002, 10003, '[已删]研发规范过期版', 'pdf',  6, NULL, 51004, DATE_SUB(NOW(3), INTERVAL 3 DAY),  10002, 10003, 10002, NOW(3), NOW(3), NULL),
	(50006, 40004, 10003, '[已删]Alpha方案草案',  'docx', 6, NULL, 51006, DATE_SUB(NOW(3), INTERVAL 2 DAY),  10003, 10003, 10003, NOW(3), NOW(3), NULL),
	(50007, 40003, 10003, '[已删]竞品调研-旧版',  'md',   6, NULL, 51007, DATE_SUB(NOW(3), INTERVAL 7 DAY),  10003, 10003, 10003, NOW(3), NOW(3), NULL),
	(50008, 40002, 10006, '[已删]线上问题汇总',   'xlsx', 6, NULL, 51008, DATE_SUB(NOW(3), INTERVAL 1 DAY),  10006, 10006, 10006, NOW(3), NOW(3), NULL),
	(50009, 40001, 10001, '[已删]公司制度-v0.1',  'pdf',  6, NULL, 51009, DATE_SUB(NOW(3), INTERVAL 15 DAY), 10001, 10001, 10001, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
	status             = VALUES(status),
	deleted_at_real    = VALUES(deleted_at_real),
	deleted_by_user_id = VALUES(deleted_by_user_id),
	current_version_id = VALUES(current_version_id),
	updated_at         = NOW(3);

-- ---------------------------------------------------------
-- 5. 软删文档对应版本种子
-- ---------------------------------------------------------
INSERT INTO doc_document_versions (
	id, document_id, version_no, storage_key, storage_bucket, file_size, mime_type,
	checksum, source_type, change_note, uploaded_by, published_at,
	created_at, updated_at, deleted_at
) VALUES
	(51004, 50005, 'v1.0', 'docs/deleted/rd-guide-v1.pdf',     'docflow-local',  512000, 'application/pdf',
	 'sha256_recycle_50005_v1', 1, '初版',       10002, DATE_SUB(NOW(3), INTERVAL 30 DAY), NOW(3), NOW(3), NULL),
	(51005, 50006, 'v1.0', 'docs/deleted/alpha-draft-v1.docx', 'docflow-local',  128000,
	 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	 'sha256_recycle_50006_v1', 1, '草案',       10003, DATE_SUB(NOW(3), INTERVAL 20 DAY), NOW(3), NOW(3), NULL),
	(51006, 50006, 'v2.0', 'docs/deleted/alpha-draft-v2.docx', 'docflow-local',  160000,
	 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	 'sha256_recycle_50006_v2', 1, '修订',       10003, DATE_SUB(NOW(3), INTERVAL 10 DAY), NOW(3), NOW(3), NULL),
	(51007, 50007, 'v1.0', 'docs/deleted/competitor-v1.md',    'docflow-local',    8192, 'text/markdown',
	 'sha256_recycle_50007_v1', 1, '初版',       10003, DATE_SUB(NOW(3), INTERVAL 40 DAY), NOW(3), NOW(3), NULL),
	(51008, 50008, 'v1.0', 'docs/deleted/issue-log-v1.xlsx',   'docflow-local', 2048000,
	 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	 'sha256_recycle_50008_v1', 1, '第一周汇总', 10006, DATE_SUB(NOW(3), INTERVAL 5 DAY),  NOW(3), NOW(3), NULL),
	(51009, 50009, 'v0.1', 'docs/deleted/policy-v0.1.pdf',     'docflow-local', 1048576, 'application/pdf',
	 'sha256_recycle_50009_v1', 1, '早期稿',     10001, DATE_SUB(NOW(3), INTERVAL 60 DAY), NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
	version_no = VALUES(version_no),
	file_size  = VALUES(file_size),
	updated_at = NOW(3);

SET FOREIGN_KEY_CHECKS = 1;
