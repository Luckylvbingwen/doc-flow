-- =========================
-- 0. 基础设置
-- =========================
CREATE DATABASE IF NOT EXISTS docflow
CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

USE docflow;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================
-- 1. 用户与组织
-- =========================
DROP TABLE IF EXISTS doc_users;
CREATE TABLE doc_users (
id BIGINT UNSIGNED PRIMARY KEY COMMENT '用户ID',
feishu_open_id VARCHAR(64) NOT NULL COMMENT '飞书open_id',
feishu_union_id VARCHAR(64) DEFAULT NULL,
name VARCHAR(100) NOT NULL,
email VARCHAR(150) DEFAULT NULL,
mobile VARCHAR(32) DEFAULT NULL,
avatar_url VARCHAR(500) DEFAULT NULL,
status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
last_login_at DATETIME(3) DEFAULT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
UNIQUE KEY uk_feishu_open_id (feishu_open_id),
KEY idx_name (name),
KEY idx_status (status),
KEY idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';


DROP TABLE IF EXISTS doc_departments;
CREATE TABLE doc_departments (
id BIGINT UNSIGNED PRIMARY KEY COMMENT '部门ID',
name VARCHAR(150) NOT NULL,
description VARCHAR(500) DEFAULT NULL,
owner_user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '负责人',
status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
created_by BIGINT UNSIGNED NOT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
UNIQUE KEY uk_dept_name_deleted (name, deleted_at),
KEY idx_owner (owner_user_id),
KEY idx_deleted_at (deleted_at),
CONSTRAINT fk_departments_owner FOREIGN KEY (owner_user_id) REFERENCES doc_users(id),
CONSTRAINT fk_departments_created_by FOREIGN KEY (created_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门';


DROP TABLE IF EXISTS doc_product_lines;
CREATE TABLE doc_product_lines (
id BIGINT UNSIGNED PRIMARY KEY COMMENT '产品线ID',
name VARCHAR(150) NOT NULL,
description VARCHAR(500) DEFAULT NULL,
owner_user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '负责人',
status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
created_by BIGINT UNSIGNED NOT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
UNIQUE KEY uk_pl_name_deleted (name, deleted_at),
KEY idx_owner (owner_user_id),
KEY idx_deleted_at (deleted_at),
CONSTRAINT fk_product_lines_owner FOREIGN KEY (owner_user_id) REFERENCES doc_users(id),
CONSTRAINT fk_product_lines_created_by FOREIGN KEY (created_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品线';


DROP TABLE IF EXISTS doc_groups;

CREATE TABLE doc_groups (
id BIGINT UNSIGNED PRIMARY KEY COMMENT '组ID',
parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父组ID，NULL表示顶级',
scope_type TINYINT NOT NULL COMMENT '1公司层 2部门层 3产品线层 4项目组',
scope_ref_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联部门/产品线ID',
name VARCHAR(150) NOT NULL,
description VARCHAR(500) DEFAULT NULL,
owner_user_id BIGINT UNSIGNED NOT NULL COMMENT '组负责人',
approval_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '1开启审批 0关闭',
file_size_limit_mb INT NOT NULL DEFAULT 50 COMMENT '单文件大小限制',
allowed_file_types VARCHAR(500) DEFAULT NULL COMMENT '文件类型白名单JSON，如["docx","pdf"]',
file_name_regex VARCHAR(300) DEFAULT NULL COMMENT '命名规范正则',
status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
created_by BIGINT UNSIGNED NOT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
UNIQUE KEY uk_parent_name_deleted (parent_id, name, deleted_at),
KEY idx_parent (parent_id),
KEY idx_scope (scope_type, scope_ref_id),
KEY idx_owner (owner_user_id),
KEY idx_deleted_at (deleted_at),
CONSTRAINT fk_doc_groups_parent FOREIGN KEY (parent_id) REFERENCES doc_groups(id),
CONSTRAINT fk_doc_groups_owner FOREIGN KEY (owner_user_id) REFERENCES doc_users(id),
CONSTRAINT fk_doc_groups_created_by FOREIGN KEY (created_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档组/项目组（树结构）';

DROP TABLE IF EXISTS doc_group_members;
CREATE TABLE doc_group_members (
id BIGINT UNSIGNED PRIMARY KEY COMMENT '成员关系ID',
group_id BIGINT UNSIGNED NOT NULL,
user_id BIGINT UNSIGNED NOT NULL,
role TINYINT NOT NULL COMMENT '1管理员 2上传下载 3仅下载 4只读',
source_type TINYINT NOT NULL DEFAULT 1 COMMENT '1手动 2自动规则',
immutable_flag TINYINT NOT NULL DEFAULT 0 COMMENT '1不可移除',
joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
created_by BIGINT UNSIGNED NOT NULL,
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
UNIQUE KEY uk_group_user_deleted (group_id, user_id, deleted_at),
KEY idx_user (user_id),
KEY idx_group_role (group_id, role),
KEY idx_deleted_at (deleted_at),
CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES doc_groups(id),
CONSTRAINT fk_group_members_user FOREIGN KEY (user_id) REFERENCES doc_users(id),
CONSTRAINT fk_group_members_created_by FOREIGN KEY (created_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组成员权限';

-- =========================
-- 2. 文档与版本
-- =========================
DROP TABLE IF EXISTS doc_documents;
CREATE TABLE doc_documents (
id BIGINT UNSIGNED PRIMARY KEY COMMENT '文档ID',
group_id BIGINT UNSIGNED NOT NULL,
title VARCHAR(255) NOT NULL COMMENT '文档名(逻辑名)',
ext VARCHAR(20) DEFAULT NULL COMMENT '文件扩展名',
status TINYINT NOT NULL COMMENT '1待审批 2审批中 3已发布 4已驳回 5已撤回 6已删除',
current_version_id BIGINT UNSIGNED DEFAULT NULL COMMENT '当前发布版本ID',
download_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '下载次数',
created_by BIGINT UNSIGNED NOT NULL,
updated_by BIGINT UNSIGNED DEFAULT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
KEY idx_group_status_updated (group_id, status, updated_at),
KEY idx_created_by (created_by),
KEY idx_deleted_at (deleted_at),
FULLTEXT KEY ft_title (title),
CONSTRAINT fk_documents_group FOREIGN KEY (group_id) REFERENCES doc_groups(id),
CONSTRAINT fk_documents_created_by FOREIGN KEY (created_by) REFERENCES doc_users(id),
CONSTRAINT fk_documents_updated_by FOREIGN KEY (updated_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档主表';

DROP TABLE IF EXISTS doc_document_versions;
CREATE TABLE doc_document_versions (
id BIGINT UNSIGNED PRIMARY KEY COMMENT '版本ID',
document_id BIGINT UNSIGNED NOT NULL,
version_no VARCHAR(20) NOT NULL COMMENT '如v1.0/v1.1',
storage_key VARCHAR(500) NOT NULL COMMENT '对象存储key',
storage_bucket VARCHAR(100) NOT NULL,
file_size BIGINT UNSIGNED NOT NULL,
mime_type VARCHAR(120) DEFAULT NULL,
checksum VARCHAR(128) DEFAULT NULL COMMENT 'sha256/md5',
source_type TINYINT NOT NULL DEFAULT 1 COMMENT '1本地上传 2飞书归档',
source_meta JSON DEFAULT NULL COMMENT '来源元信息',
change_note VARCHAR(500) DEFAULT NULL,
uploaded_by BIGINT UNSIGNED NOT NULL,
published_at DATETIME(3) DEFAULT NULL COMMENT '审批通过发布时间',
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
UNIQUE KEY uk_doc_version_deleted (document_id, version_no, deleted_at),
KEY idx_doc_created (document_id, created_at),
KEY idx_uploaded_by (uploaded_by),
KEY idx_deleted_at (deleted_at),
CONSTRAINT fk_doc_versions_doc FOREIGN KEY (document_id) REFERENCES doc_documents(id),
CONSTRAINT fk_doc_versions_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档版本表';

ALTER TABLE doc_documents
ADD CONSTRAINT fk_documents_current_version
FOREIGN KEY (current_version_id) REFERENCES doc_document_versions(id);

DROP TABLE IF EXISTS doc_document_permissions;
CREATE TABLE doc_document_permissions (
id BIGINT UNSIGNED PRIMARY KEY COMMENT '文档级权限ID',
document_id BIGINT UNSIGNED NOT NULL,
user_id BIGINT UNSIGNED NOT NULL,
role TINYINT NOT NULL COMMENT '2上传下载 3仅下载 4只读',
granted_by BIGINT UNSIGNED NOT NULL,
expires_at DATETIME(3) DEFAULT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
UNIQUE KEY uk_doc_user_deleted (document_id, user_id, deleted_at),
KEY idx_user (user_id),
KEY idx_expires_at (expires_at),
KEY idx_deleted_at (deleted_at),
CONSTRAINT fk_doc_permissions_doc FOREIGN KEY (document_id) REFERENCES doc_documents(id),
CONSTRAINT fk_doc_permissions_user FOREIGN KEY (user_id) REFERENCES doc_users(id),
CONSTRAINT fk_doc_permissions_granted_by FOREIGN KEY (granted_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档级权限（覆盖组级）';

DROP TABLE IF EXISTS doc_document_favorites;
CREATE TABLE doc_document_favorites (
id BIGINT UNSIGNED PRIMARY KEY,
document_id BIGINT UNSIGNED NOT NULL,
user_id BIGINT UNSIGNED NOT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
UNIQUE KEY uk_doc_fav_user (document_id, user_id),
KEY idx_user_created (user_id, created_at),
CONSTRAINT fk_document_favorites_doc FOREIGN KEY (document_id) REFERENCES doc_documents(id),
CONSTRAINT fk_document_favorites_user FOREIGN KEY (user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏';

DROP TABLE IF EXISTS doc_document_pins;
CREATE TABLE doc_document_pins (
id BIGINT UNSIGNED PRIMARY KEY,
document_id BIGINT UNSIGNED NOT NULL,
pinned_by BIGINT UNSIGNED NOT NULL,
pinned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
UNIQUE KEY uk_doc_pin (document_id),
KEY idx_pinned_at (pinned_at),
CONSTRAINT fk_document_pins_doc FOREIGN KEY (document_id) REFERENCES doc_documents(id),
CONSTRAINT fk_document_pins_user FOREIGN KEY (pinned_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='置顶（组内全局）';

DROP TABLE IF EXISTS doc_document_comments;
CREATE TABLE doc_document_comments (
id BIGINT UNSIGNED PRIMARY KEY,
document_id BIGINT UNSIGNED NOT NULL,
user_id BIGINT UNSIGNED NOT NULL,
content TEXT NOT NULL,
emoji_meta JSON DEFAULT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
KEY idx_doc_created (document_id, created_at),
KEY idx_user (user_id),
KEY idx_deleted_at (deleted_at),
CONSTRAINT fk_document_comments_doc FOREIGN KEY (document_id) REFERENCES doc_documents(id),
CONSTRAINT fk_document_comments_user FOREIGN KEY (user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档评论';

-- =========================
-- 3. 审批流
-- =========================
DROP TABLE IF EXISTS doc_approval_templates;
CREATE TABLE doc_approval_templates (
id BIGINT UNSIGNED PRIMARY KEY,
group_id BIGINT UNSIGNED NOT NULL,
mode TINYINT NOT NULL COMMENT '1依次审批 2会签审批',
timeout_hours INT NOT NULL DEFAULT 24,
enabled TINYINT NOT NULL DEFAULT 1,
created_by BIGINT UNSIGNED NOT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at DATETIME(3) DEFAULT NULL,
UNIQUE KEY uk_group_deleted (group_id, deleted_at),
KEY idx_enabled (enabled),
CONSTRAINT fk_approval_templates_group FOREIGN KEY (group_id) REFERENCES doc_groups(id),
CONSTRAINT fk_approval_templates_created_by FOREIGN KEY (created_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批模板';

DROP TABLE IF EXISTS doc_approval_template_nodes;
CREATE TABLE doc_approval_template_nodes (
id BIGINT UNSIGNED PRIMARY KEY,
template_id BIGINT UNSIGNED NOT NULL,
order_no INT NOT NULL,
approver_user_id BIGINT UNSIGNED NOT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
UNIQUE KEY uk_template_order (template_id, order_no),
KEY idx_template_approver (template_id, approver_user_id),
CONSTRAINT fk_approval_template_nodes_template FOREIGN KEY (template_id) REFERENCES doc_approval_templates(id),
CONSTRAINT fk_approval_template_nodes_approver FOREIGN KEY (approver_user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批模板节点';

DROP TABLE IF EXISTS doc_approval_instances;
CREATE TABLE doc_approval_instances (
id BIGINT UNSIGNED PRIMARY KEY,
biz_type TINYINT NOT NULL COMMENT '1文档发布',
biz_id BIGINT UNSIGNED NOT NULL COMMENT '关联doc_document_versions.id',
template_id BIGINT UNSIGNED DEFAULT NULL,
mode TINYINT NOT NULL COMMENT '1依次审批 2会签审批',
status TINYINT NOT NULL COMMENT '1待审批 2审批中 3通过 4驳回 5撤回',
initiator_user_id BIGINT UNSIGNED NOT NULL,
current_node_order INT DEFAULT NULL COMMENT '依次审批当前节点',
started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
finished_at DATETIME(3) DEFAULT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
KEY idx_biz_status (biz_type, biz_id, status),
KEY idx_initiator_created (initiator_user_id, created_at),
KEY idx_template (template_id),
CONSTRAINT fk_approval_instances_template FOREIGN KEY (template_id) REFERENCES doc_approval_templates(id),
CONSTRAINT fk_approval_instances_initiator FOREIGN KEY (initiator_user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批实例';

DROP TABLE IF EXISTS doc_approval_instance_nodes;
CREATE TABLE doc_approval_instance_nodes (
id BIGINT UNSIGNED PRIMARY KEY,
instance_id BIGINT UNSIGNED NOT NULL,
node_order INT NOT NULL,
approver_user_id BIGINT UNSIGNED NOT NULL,
action_status TINYINT NOT NULL DEFAULT 1 COMMENT '1待处理 2通过 3驳回',
action_comment VARCHAR(500) DEFAULT NULL,
action_at DATETIME(3) DEFAULT NULL,
remind_count TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已催办次数',
last_reminded_at DATETIME(3) DEFAULT NULL COMMENT '最后催办时间',
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
UNIQUE KEY uk_instance_order (instance_id, node_order),
KEY idx_instance_approver (instance_id, approver_user_id),
KEY idx_approver_status (approver_user_id, action_status),
CONSTRAINT fk_approval_instance_nodes_instance FOREIGN KEY (instance_id) REFERENCES doc_approval_instances(id),
CONSTRAINT fk_approval_instance_nodes_approver FOREIGN KEY (approver_user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批实例节点';

-- =========================
-- 4. 通知与日志
-- =========================
DROP TABLE IF EXISTS doc_notifications;
CREATE TABLE doc_notifications (
id BIGINT UNSIGNED PRIMARY KEY,
user_id BIGINT UNSIGNED NOT NULL,
type TINYINT NOT NULL COMMENT '1审批通知 2系统通知 3成员变更',
title VARCHAR(200) NOT NULL,
content VARCHAR(2000) DEFAULT NULL,
biz_type TINYINT DEFAULT NULL,
biz_id BIGINT UNSIGNED DEFAULT NULL,
read_at DATETIME(3) DEFAULT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
KEY idx_user_read_created (user_id, read_at, created_at),
CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内通知';

DROP TABLE IF EXISTS doc_operation_logs;
CREATE TABLE doc_operation_logs (
id BIGINT UNSIGNED PRIMARY KEY,
actor_user_id BIGINT UNSIGNED NOT NULL,
action VARCHAR(100) NOT NULL COMMENT '如group.create/doc.upload/approval.pass',
target_type VARCHAR(50) NOT NULL COMMENT 'group/document/version/user/approval',
target_id BIGINT UNSIGNED DEFAULT NULL,
group_id BIGINT UNSIGNED DEFAULT NULL,
document_id BIGINT UNSIGNED DEFAULT NULL,
detail_json JSON DEFAULT NULL,
ip VARCHAR(64) DEFAULT NULL,
user_agent VARCHAR(500) DEFAULT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
KEY idx_actor_time (actor_user_id, created_at),
KEY idx_target_time (target_type, target_id, created_at),
KEY idx_group_time (group_id, created_at),
KEY idx_document_time (document_id, created_at),
CONSTRAINT fk_operation_logs_actor FOREIGN KEY (actor_user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作审计日志';

-- =========================
-- 5. 可选：搜索索引表（如果不用ES）
-- =========================
DROP TABLE IF EXISTS doc_search_index_docs;
CREATE TABLE doc_search_index_docs (
id BIGINT UNSIGNED PRIMARY KEY,
document_id BIGINT UNSIGNED NOT NULL,
group_id BIGINT UNSIGNED NOT NULL,
title VARCHAR(255) NOT NULL,
content_plain MEDIUMTEXT,
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
UNIQUE KEY uk_document_id (document_id),
FULLTEXT KEY ft_title_content (title, content_plain),
KEY idx_group_updated (group_id, updated_at),
CONSTRAINT fk_search_index_docs_doc FOREIGN KEY (document_id) REFERENCES doc_documents(id),
CONSTRAINT fk_search_index_docs_group FOREIGN KEY (group_id) REFERENCES doc_groups(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全文检索索引（可选）';

-- =========================
-- 6. 全局配置
-- =========================
DROP TABLE IF EXISTS doc_system_config;
CREATE TABLE doc_system_config (
id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
config_key VARCHAR(100) NOT NULL COMMENT '配置键',
config_value VARCHAR(2000) NOT NULL COMMENT '配置值',
description VARCHAR(300) DEFAULT NULL COMMENT '说明',
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全局配置表';

INSERT INTO doc_system_config (config_key, config_value, description) VALUES
('file_size_limit_mb',      '200',                           '单文件大小上限(MB)'),
('allowed_file_types',      '["docx","xlsx","pdf","md","pptx"]', '支持的文件类型'),
('version_retention_limit', '50',                            '版本保留数上限'),
('approval_timeout_hours',  '24',                            '审批超时默认时间(小时)'),
('remind_max_count',        '3',                             '催办次数上限');

SET FOREIGN_KEY_CHECKS = 1;