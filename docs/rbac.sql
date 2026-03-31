-- =============================================================
-- RBAC 权限管理 DDL + 种子数据
-- 依赖：doc_users 表已存在
-- 用法：在 docflow 数据库上执行此脚本
-- =============================================================
USE docflow;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------
-- 1. 权限定义表
-- ---------------------------------------------------------
DROP TABLE IF EXISTS sys_role_permissions;
DROP TABLE IF EXISTS sys_user_roles;
DROP TABLE IF EXISTS sys_permissions;
DROP TABLE IF EXISTS sys_roles;

CREATE TABLE sys_permissions (
	id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
	code        VARCHAR(100) NOT NULL COMMENT '权限标识，如 user:create',
	name        VARCHAR(100) NOT NULL COMMENT '权限名称',
	module      VARCHAR(50)  NOT NULL COMMENT '所属模块',
	description VARCHAR(300) DEFAULT NULL,
	sort_order  INT          NOT NULL DEFAULT 0,
	created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	UNIQUE KEY uk_code (code),
	KEY idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限定义表';

-- ---------------------------------------------------------
-- 2. 角色表
-- ---------------------------------------------------------
CREATE TABLE sys_roles (
	id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
	code        VARCHAR(50)  NOT NULL COMMENT '角色标识',
	name        VARCHAR(100) NOT NULL COMMENT '角色名称',
	description VARCHAR(300) DEFAULT NULL,
	is_system   TINYINT      NOT NULL DEFAULT 0 COMMENT '1系统内置不可删除',
	status      TINYINT      NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
	created_by  BIGINT UNSIGNED DEFAULT NULL,
	created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	deleted_at  DATETIME(3)  DEFAULT NULL,
	UNIQUE KEY uk_code_deleted (code, deleted_at),
	KEY idx_status (status),
	KEY idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- ---------------------------------------------------------
-- 3. 角色-权限关联表
-- ---------------------------------------------------------
CREATE TABLE sys_role_permissions (
	id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
	role_id       BIGINT UNSIGNED NOT NULL,
	permission_id BIGINT UNSIGNED NOT NULL,
	created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	UNIQUE KEY uk_role_perm (role_id, permission_id),
	KEY idx_permission (permission_id),
	CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES sys_roles(id) ON DELETE CASCADE,
	CONSTRAINT fk_role_permissions_perm FOREIGN KEY (permission_id) REFERENCES sys_permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色-权限关联';

-- ---------------------------------------------------------
-- 4. 用户-角色关联表
-- ---------------------------------------------------------
CREATE TABLE sys_user_roles (
	id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
	user_id    BIGINT UNSIGNED NOT NULL,
	role_id    BIGINT UNSIGNED NOT NULL,
	scope_type TINYINT         DEFAULT NULL COMMENT '管理范围类型: 1部门 2产品线, NULL表示全局',
	scope_ref_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联 doc_departments/doc_product_lines.id',
	created_by BIGINT UNSIGNED DEFAULT NULL,
	created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	UNIQUE KEY uk_user_role_scope (user_id, role_id, scope_type, scope_ref_id),
	KEY idx_role (role_id),
	KEY idx_scope (scope_type, scope_ref_id),
	CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES doc_users(id),
	CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES sys_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-角色关联';

-- =========================================================
-- 种子数据
-- =========================================================

-- ── 权限种子 ──
INSERT INTO sys_permissions (code, name, module, description, sort_order) VALUES
-- 用户管理
('user:read',   '查看用户',   'user', '查看用户列表与详情', 100),
('user:create', '创建用户',   'user', '创建新用户',         101),
('user:update', '编辑用户',   'user', '修改用户信息',       102),
('user:delete', '删除用户',   'user', '停用或删除用户',     103),
-- 角色管理
('role:read',   '查看角色',   'role', '查看角色列表与详情', 200),
('role:create', '创建角色',   'role', '创建新角色',         201),
('role:update', '编辑角色',   'role', '修改角色信息与权限', 202),
('role:delete', '删除角色',   'role', '删除非内置角色',     203),
('role:assign', '分配角色',   'role', '为用户分配或撤销角色', 204),
-- 权限查看
('permission:read', '查看权限', 'permission', '查看权限清单', 300),
-- 文档管理
('doc:read',     '查看文档',   'doc', '查看文档列表与详情', 400),
('doc:create',   '创建文档',   'doc', '上传或新建文档',     401),
('doc:update',   '编辑文档',   'doc', '修改文档信息',       402),
('doc:delete',   '删除文档',   'doc', '删除或移入回收站',   403),
('doc:download', '下载文档',   'doc', '下载文档文件',       404),
-- 审批管理
('approval:read',    '查看审批', 'approval', '查看审批列表',     500),
('approval:process', '处理审批', 'approval', '通过或驳回审批',   501),
('approval:config',  '审批配置', 'approval', '配置审批模板与流程', 502),
-- 日志
('log:read', '查看日志', 'log', '查看操作审计日志', 600),
-- 通知
('notification:read',   '查看通知', 'notification', '查看站内通知',   700),
('notification:manage', '管理通知', 'notification', '管理通知策略',   701),
-- 系统
('system:config', '系统配置', 'system', '修改系统级配置', 800);

-- ── 角色种子 ──
INSERT INTO sys_roles (code, name, description, is_system) VALUES
('super_admin', '超级管理员', '拥有全部权限，不可删除',               1),
('admin',       '管理员',     '日常管理权限，不含超级管理操作',       1),
('editor',      '编辑者',     '文档读写、审批处理',                   0),
('viewer',      '访客',       '仅查看权限',                           0);

-- ── super_admin → 所有权限 ──
INSERT INTO sys_role_permissions (role_id, permission_id)
SELECT
	(SELECT id FROM sys_roles WHERE code = 'super_admin'),
	id
FROM sys_permissions;

-- ── admin → 除 system:config 外的所有权限 ──
INSERT INTO sys_role_permissions (role_id, permission_id)
SELECT
	(SELECT id FROM sys_roles WHERE code = 'admin'),
	id
FROM sys_permissions
WHERE code != 'system:config';

-- ── editor → 文档 + 审批读/处理 + 通知读 ──
INSERT INTO sys_role_permissions (role_id, permission_id)
SELECT
	(SELECT id FROM sys_roles WHERE code = 'editor'),
	id
FROM sys_permissions
WHERE code IN (
	'doc:read','doc:create','doc:update','doc:download',
	'approval:read','approval:process',
	'notification:read','log:read'
);

-- ── viewer → 只读权限 ──
INSERT INTO sys_role_permissions (role_id, permission_id)
SELECT
	(SELECT id FROM sys_roles WHERE code = 'viewer'),
	id
FROM sys_permissions
WHERE code IN ('doc:read','doc:download','approval:read','notification:read','log:read');

-- =========================================================
-- 用户-角色分配种子（对应 doc_seed.sql 中的预制用户）
-- =========================================================
INSERT INTO sys_user_roles (user_id, role_id) VALUES
-- 系统管理员 → 超级管理员
((SELECT id FROM doc_users WHERE email = 'admin@docflow.local'),
 (SELECT id FROM sys_roles WHERE code = 'super_admin')),
-- 文档负责人 → 管理员
((SELECT id FROM doc_users WHERE email = 'owner@docflow.local'),
 (SELECT id FROM sys_roles WHERE code = 'admin')),
-- 文档编辑 → 编辑者
((SELECT id FROM doc_users WHERE email = 'editor@docflow.local'),
 (SELECT id FROM sys_roles WHERE code = 'editor')),
-- 审批人A → 编辑者
((SELECT id FROM doc_users WHERE email = 'reviewer.a@docflow.local'),
 (SELECT id FROM sys_roles WHERE code = 'editor')),
-- 审批人B → 编辑者
((SELECT id FROM doc_users WHERE email = 'reviewer.b@docflow.local'),
 (SELECT id FROM sys_roles WHERE code = 'editor')),
-- 只读访客 → 访客
((SELECT id FROM doc_users WHERE email = 'reader@docflow.local'),
 (SELECT id FROM sys_roles WHERE code = 'viewer'));

SET FOREIGN_KEY_CHECKS = 1;
