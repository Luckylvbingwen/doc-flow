-- =============================================================
-- DocFlow 增量补丁 patch-001
-- 日期: 2026-03-31
-- 说明: 补充全局配置表、RBAC管理范围、下载计数、催办追踪、文件类型白名单
-- 执行: 在 docflow 数据库上直接执行
-- =============================================================

USE docflow;
SET NAMES utf8mb4;

-- ---------------------------------------------------------
-- 1. doc_groups: 删除冗余的 approval_mode，新增 allowed_file_types
-- ---------------------------------------------------------
ALTER TABLE doc_groups
  DROP COLUMN approval_mode;

ALTER TABLE doc_groups
  ADD COLUMN allowed_file_types VARCHAR(500) DEFAULT NULL COMMENT '文件类型白名单JSON，如["docx","pdf"]'
  AFTER file_size_limit_mb;

-- ---------------------------------------------------------
-- 2. doc_documents: 新增下载计数字段
-- ---------------------------------------------------------
ALTER TABLE doc_documents
  ADD COLUMN download_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '下载次数'
  AFTER current_version_id;

-- ---------------------------------------------------------
-- 3. doc_approval_instance_nodes: 新增催办追踪字段
-- ---------------------------------------------------------
ALTER TABLE doc_approval_instance_nodes
  ADD COLUMN remind_count TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已催办次数'
  AFTER action_at,
  ADD COLUMN last_reminded_at DATETIME(3) DEFAULT NULL COMMENT '最后催办时间'
  AFTER remind_count;

-- ---------------------------------------------------------
-- 4. sys_user_roles: 新增管理范围字段，替换唯一键
-- ---------------------------------------------------------
ALTER TABLE sys_user_roles
  ADD COLUMN scope_type TINYINT DEFAULT NULL COMMENT '管理范围类型: 1部门 2产品线, NULL表示全局'
  AFTER role_id,
  ADD COLUMN scope_ref_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联 doc_departments/doc_product_lines.id'
  AFTER scope_type;

-- 先删旧唯一键，再建新的（包含 scope）
ALTER TABLE sys_user_roles
  DROP INDEX uk_user_role,
  ADD UNIQUE KEY uk_user_role_scope (user_id, role_id, scope_type, scope_ref_id),
  ADD KEY idx_scope (scope_type, scope_ref_id);

-- ---------------------------------------------------------
-- 5. 全局配置表（新建）
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS doc_system_config (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  config_key   VARCHAR(100)  NOT NULL COMMENT '配置键',
  config_value VARCHAR(2000) NOT NULL COMMENT '配置值',
  description  VARCHAR(300)  DEFAULT NULL COMMENT '说明',
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全局配置表';

-- 种子数据（IGNORE 避免重复插入）
INSERT IGNORE INTO doc_system_config (config_key, config_value, description) VALUES
  ('file_size_limit_mb',      '200',                               '单文件大小上限(MB)'),
  ('allowed_file_types',      '["docx","xlsx","pdf","md","pptx"]',  '支持的文件类型'),
  ('version_retention_limit', '50',                                '版本保留数上限'),
  ('approval_timeout_hours',  '24',                                '审批超时默认时间(小时)'),
  ('remind_max_count',        '3',                                 '催办次数上限');

-- =============================================================
-- 补丁执行完毕
-- =============================================================
