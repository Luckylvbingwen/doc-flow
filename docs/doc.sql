-- =============================================================
-- DocFlow 全量建表脚本
-- 对齐：企业文档管理系统-产品需求说明文档 v2.1 (2026-04-14)
-- 执行顺序：doc.sql → rbac.sql → doc_seed.sql
-- =============================================================

CREATE DATABASE IF NOT EXISTS docflow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE docflow;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- 1. 用户与组织
-- =========================================================

-- ---------------------------------------------------------
-- 1.1 用户表
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_users;
CREATE TABLE doc_users (
  id              BIGINT UNSIGNED PRIMARY KEY COMMENT '用户ID（雪花）',
  feishu_open_id  VARCHAR(64)  NOT NULL COMMENT '飞书 open_id',
  feishu_union_id VARCHAR(64)  DEFAULT NULL,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(150) DEFAULT NULL,
  mobile          VARCHAR(32)  DEFAULT NULL,
  avatar_url      VARCHAR(500) DEFAULT NULL,
  password_hash   VARCHAR(255) DEFAULT NULL COMMENT 'bcrypt 密码哈希',
  status          TINYINT      NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  last_login_at   DATETIME(3)  DEFAULT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3)  DEFAULT NULL,
  UNIQUE KEY uk_feishu_open_id (feishu_open_id),
  KEY idx_name       (name),
  KEY idx_status     (status),
  KEY idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ---------------------------------------------------------
-- 1.2 部门（飞书单向同步，DocFlow 不可增删）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_departments;
CREATE TABLE doc_departments (
  id                  BIGINT UNSIGNED PRIMARY KEY COMMENT '部门ID',
  feishu_department_id VARCHAR(64) DEFAULT NULL COMMENT '飞书部门 open_department_id',
  name                VARCHAR(150) NOT NULL,
  description         VARCHAR(500) DEFAULT NULL,
  owner_user_id       BIGINT UNSIGNED DEFAULT NULL COMMENT '部门负责人（飞书主管同步）',
  status              TINYINT      NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_by          BIGINT UNSIGNED NOT NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at          DATETIME(3)  DEFAULT NULL,
  UNIQUE KEY uk_feishu_dept (feishu_department_id),
  UNIQUE KEY uk_dept_name_deleted (name, deleted_at),
  KEY idx_owner      (owner_user_id),
  KEY idx_deleted_at (deleted_at),
  CONSTRAINT fk_departments_owner      FOREIGN KEY (owner_user_id) REFERENCES doc_users(id),
  CONSTRAINT fk_departments_created_by FOREIGN KEY (created_by)    REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门（飞书同步）';

-- ---------------------------------------------------------
-- 1.3 部门管理员（由部门负责人指派，§6.3.2）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_department_admins;
CREATE TABLE doc_department_admins (
  id            BIGINT UNSIGNED PRIMARY KEY COMMENT 'ID',
  department_id BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  created_by    BIGINT UNSIGNED NOT NULL COMMENT '指派人（部门负责人）',
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_dept_user (department_id, user_id),
  KEY idx_user (user_id),
  CONSTRAINT fk_dept_admins_dept    FOREIGN KEY (department_id) REFERENCES doc_departments(id),
  CONSTRAINT fk_dept_admins_user    FOREIGN KEY (user_id)       REFERENCES doc_users(id),
  CONSTRAINT fk_dept_admins_creator FOREIGN KEY (created_by)    REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门管理员';

-- ---------------------------------------------------------
-- 1.4 产品线（DocFlow 自建，§6.3.2）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_product_lines;
CREATE TABLE doc_product_lines (
  id            BIGINT UNSIGNED PRIMARY KEY COMMENT '产品线ID',
  name          VARCHAR(150)    NOT NULL,
  description   VARCHAR(500)    DEFAULT NULL,
  owner_user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '产品线负责人',
  status        TINYINT         NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at    DATETIME(3)     DEFAULT NULL,
  UNIQUE KEY uk_pl_name_deleted (name, deleted_at),
  KEY idx_owner      (owner_user_id),
  KEY idx_deleted_at (deleted_at),
  CONSTRAINT fk_product_lines_owner      FOREIGN KEY (owner_user_id) REFERENCES doc_users(id),
  CONSTRAINT fk_product_lines_created_by FOREIGN KEY (created_by)    REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品线';

-- ---------------------------------------------------------
-- 1.5 产品线管理员（由产品线负责人指派，§6.3.2）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_product_line_admins;
CREATE TABLE doc_product_line_admins (
  id              BIGINT UNSIGNED PRIMARY KEY COMMENT 'ID',
  product_line_id BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  created_by      BIGINT UNSIGNED NOT NULL COMMENT '指派人（产品线负责人）',
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_pl_user (product_line_id, user_id),
  KEY idx_user (user_id),
  CONSTRAINT fk_pl_admins_pl      FOREIGN KEY (product_line_id) REFERENCES doc_product_lines(id),
  CONSTRAINT fk_pl_admins_user    FOREIGN KEY (user_id)         REFERENCES doc_users(id),
  CONSTRAINT fk_pl_admins_creator FOREIGN KEY (created_by)      REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品线管理员';

-- ---------------------------------------------------------
-- 1.6 文档组（树结构，支持无限嵌套，§6.3.2）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_groups;
CREATE TABLE doc_groups (
  id                 BIGINT UNSIGNED PRIMARY KEY COMMENT '组ID',
  parent_id          BIGINT UNSIGNED DEFAULT NULL COMMENT '父组ID，NULL=顶级',
  scope_type         TINYINT         NOT NULL COMMENT '1公司层 2部门 3产品线',
  scope_ref_id       BIGINT UNSIGNED DEFAULT NULL COMMENT '关联 departments/product_lines.id',
  name               VARCHAR(150)    NOT NULL,
  description        VARCHAR(500)    DEFAULT NULL,
  owner_user_id      BIGINT UNSIGNED NOT NULL COMMENT '组负责人',
  approval_enabled   TINYINT         NOT NULL DEFAULT 1 COMMENT '1开启审批 0关闭',
  file_size_limit_mb INT             NOT NULL DEFAULT 50 COMMENT '单文件大小限制(MB)',
  allowed_file_types VARCHAR(500)    DEFAULT NULL COMMENT '文件类型白名单JSON',
  file_name_regex    VARCHAR(300)    DEFAULT NULL COMMENT '命名规范正则',
  status             TINYINT         NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_by         BIGINT UNSIGNED NOT NULL,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at         DATETIME(3)     DEFAULT NULL,
  UNIQUE KEY uk_parent_name_deleted (parent_id, name, deleted_at),
  KEY idx_parent     (parent_id),
  KEY idx_scope      (scope_type, scope_ref_id),
  KEY idx_owner      (owner_user_id),
  KEY idx_deleted_at (deleted_at),
  CONSTRAINT fk_groups_parent     FOREIGN KEY (parent_id)      REFERENCES doc_groups(id),
  CONSTRAINT fk_groups_owner      FOREIGN KEY (owner_user_id)  REFERENCES doc_users(id),
  CONSTRAINT fk_groups_created_by FOREIGN KEY (created_by)     REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档组（树结构）';

-- ---------------------------------------------------------
-- 1.7 组成员（§4.2 三级权限：管理员/可编辑/上传下载）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_group_members;
CREATE TABLE doc_group_members (
  id             BIGINT UNSIGNED PRIMARY KEY COMMENT 'ID',
  group_id       BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  role           TINYINT         NOT NULL COMMENT '1管理员 2可编辑 3上传下载',
  source_type    TINYINT         NOT NULL DEFAULT 1 COMMENT '1手动添加 2飞书同步 3继承（负责人自动继承）',
  immutable_flag TINYINT         NOT NULL DEFAULT 0 COMMENT '1不可移除/降权（负责人/继承成员）',
  joined_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by     BIGINT UNSIGNED NOT NULL,
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at     DATETIME(3)     DEFAULT NULL,
  UNIQUE KEY uk_group_user_deleted (group_id, user_id, deleted_at),
  KEY idx_user       (user_id),
  KEY idx_group_role (group_id, role),
  KEY idx_deleted_at (deleted_at),
  CONSTRAINT fk_group_members_group      FOREIGN KEY (group_id)   REFERENCES doc_groups(id),
  CONSTRAINT fk_group_members_user       FOREIGN KEY (user_id)    REFERENCES doc_users(id),
  CONSTRAINT fk_group_members_created_by FOREIGN KEY (created_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组成员（§4.2 三级权限）';

-- =========================================================
-- 2. 文档与版本
-- =========================================================

-- ---------------------------------------------------------
-- 2.1 文档主表（§5.3 六种状态）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_documents;
CREATE TABLE doc_documents (
  id                 BIGINT UNSIGNED PRIMARY KEY COMMENT '文档ID',
  group_id           BIGINT UNSIGNED DEFAULT NULL COMMENT '所属组ID（草稿=NULL，提交发布时设置）',
  owner_user_id      BIGINT UNSIGNED NOT NULL COMMENT '归属人（可转移，§6.3.10）',
  title              VARCHAR(255)    NOT NULL COMMENT '文档名（逻辑名）',
  ext                VARCHAR(20)     DEFAULT NULL COMMENT '文件扩展名',
  status             TINYINT         NOT NULL COMMENT '1草稿 2编辑中 3审批中 4已发布 5已驳回 6已删除',
  source_doc_id      BIGINT UNSIGNED DEFAULT NULL COMMENT '编辑副本的源文档ID（§6.3.5，NULL=非副本）',
  current_version_id BIGINT UNSIGNED DEFAULT NULL COMMENT '当前发布版本ID',
  download_count     INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '下载次数',
  deleted_at_real    DATETIME(3)     DEFAULT NULL COMMENT '进入回收站的时间（30天后自动永久删除）',
  deleted_by_user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '删除人（软删操作人）',
  created_by         BIGINT UNSIGNED NOT NULL COMMENT '创建人',
  updated_by         BIGINT UNSIGNED DEFAULT NULL,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at         DATETIME(3)     DEFAULT NULL,
  KEY idx_group_status  (group_id, status, updated_at),
  KEY idx_owner         (owner_user_id),
  KEY idx_created_by    (created_by),
  KEY idx_source_doc    (source_doc_id),
  KEY idx_deleted_at    (deleted_at),
  KEY idx_recycle       (status, deleted_at_real),
  KEY idx_deleted_by    (deleted_by_user_id, deleted_at_real),
  FULLTEXT KEY ft_title (title),
  CONSTRAINT fk_documents_group       FOREIGN KEY (group_id)           REFERENCES doc_groups(id),
  CONSTRAINT fk_documents_owner       FOREIGN KEY (owner_user_id)      REFERENCES doc_users(id),
  CONSTRAINT fk_documents_source      FOREIGN KEY (source_doc_id)      REFERENCES doc_documents(id),
  CONSTRAINT fk_documents_created_by  FOREIGN KEY (created_by)         REFERENCES doc_users(id),
  CONSTRAINT fk_documents_updated_by  FOREIGN KEY (updated_by)         REFERENCES doc_users(id),
  CONSTRAINT fk_documents_deleted_by  FOREIGN KEY (deleted_by_user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档主表（§5.3）';

-- ---------------------------------------------------------
-- 2.2 文档版本（审批通过后的正式发布记录）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_document_versions;
CREATE TABLE doc_document_versions (
  id             BIGINT UNSIGNED PRIMARY KEY COMMENT '版本ID',
  document_id    BIGINT UNSIGNED NOT NULL,
  version_no     VARCHAR(20)     NOT NULL COMMENT '如 v1.0 / v2.0',
  storage_key    VARCHAR(500)    NOT NULL COMMENT '对象存储 key',
  storage_bucket VARCHAR(100)    NOT NULL,
  file_size      BIGINT UNSIGNED NOT NULL,
  mime_type      VARCHAR(120)    DEFAULT NULL,
  checksum       VARCHAR(128)    DEFAULT NULL COMMENT 'SHA-256',
  source_type    TINYINT         NOT NULL DEFAULT 1 COMMENT '1本地上传 2飞书归档',
  source_meta    JSON            DEFAULT NULL COMMENT '来源元信息',
  change_note    VARCHAR(500)    DEFAULT NULL COMMENT '变更说明',
  uploaded_by    BIGINT UNSIGNED NOT NULL,
  published_at   DATETIME(3)     DEFAULT NULL COMMENT '审批通过发布时间',
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at     DATETIME(3)     DEFAULT NULL,
  UNIQUE KEY uk_doc_version_deleted (document_id, version_no, deleted_at),
  KEY idx_doc_created  (document_id, created_at),
  KEY idx_uploaded_by  (uploaded_by),
  KEY idx_deleted_at   (deleted_at),
  CONSTRAINT fk_versions_doc      FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_versions_uploader FOREIGN KEY (uploaded_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档版本';

-- 文档 → 当前版本 FK（延迟创建避免循环依赖）
ALTER TABLE doc_documents
  ADD CONSTRAINT fk_documents_current_version
  FOREIGN KEY (current_version_id) REFERENCES doc_document_versions(id);

-- ---------------------------------------------------------
-- 2.3 编辑快照（§6.3.6 自动保存/手动保存/命名快照）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_document_snapshots;
CREATE TABLE doc_document_snapshots (
  id          BIGINT UNSIGNED PRIMARY KEY COMMENT '快照ID',
  document_id BIGINT UNSIGNED NOT NULL,
  type        TINYINT         NOT NULL COMMENT '1自动保存 2手动保存(Ctrl+S) 3命名快照',
  name        VARCHAR(100)    DEFAULT NULL COMMENT '快照名称（仅 type=3）',
  storage_key VARCHAR(500)    NOT NULL COMMENT '对象存储 key',
  file_size   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_by  BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_doc_created (document_id, created_at),
  KEY idx_created_by  (created_by),
  CONSTRAINT fk_snapshots_doc     FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_snapshots_creator FOREIGN KEY (created_by)  REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='编辑快照（§6.3.6）';

-- ---------------------------------------------------------
-- 2.4 文档级权限（§6.3.3 / §6.3.8 覆盖组级权限）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_document_permissions;
CREATE TABLE doc_document_permissions (
  id          BIGINT UNSIGNED PRIMARY KEY COMMENT 'ID',
  document_id BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  permission  TINYINT         NOT NULL COMMENT '1可编辑 2可阅读',
  granted_by  BIGINT UNSIGNED NOT NULL,
  expires_at  DATETIME(3)     DEFAULT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at  DATETIME(3)     DEFAULT NULL,
  UNIQUE KEY uk_doc_user_deleted (document_id, user_id, deleted_at),
  KEY idx_user       (user_id),
  KEY idx_deleted_at (deleted_at),
  CONSTRAINT fk_doc_perms_doc     FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_doc_perms_user    FOREIGN KEY (user_id)     REFERENCES doc_users(id),
  CONSTRAINT fk_doc_perms_granter FOREIGN KEY (granted_by)  REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档级权限';

-- ---------------------------------------------------------
-- 2.5 收藏（个人行为）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_document_favorites;
CREATE TABLE doc_document_favorites (
  id          BIGINT UNSIGNED PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_doc_fav_user (document_id, user_id),
  KEY idx_user_created (user_id, created_at),
  CONSTRAINT fk_favorites_doc  FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id)     REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档收藏';

-- ---------------------------------------------------------
-- 2.6 置顶（组管理员设置，组内全员生效）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_document_pins;
CREATE TABLE doc_document_pins (
  id          BIGINT UNSIGNED PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  group_id    BIGINT UNSIGNED NOT NULL COMMENT '置顶所在组（引用文档可在目标组独立置顶）',
  pinned_by   BIGINT UNSIGNED NOT NULL,
  pinned_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_doc_group_pin (document_id, group_id),
  KEY idx_group_pinned (group_id, pinned_at),
  CONSTRAINT fk_pins_doc   FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_pins_group FOREIGN KEY (group_id)    REFERENCES doc_groups(id),
  CONSTRAINT fk_pins_user  FOREIGN KEY (pinned_by)   REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档置顶';

-- =========================================================
-- 3. 评论与批注
-- =========================================================

-- ---------------------------------------------------------
-- 3.1 文档评论（支持嵌套回复，§6.3.4）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_document_comments;
CREATE TABLE doc_document_comments (
  id          BIGINT UNSIGNED PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  parent_id   BIGINT UNSIGNED DEFAULT NULL COMMENT '父评论ID（NULL=顶层评论）',
  user_id     BIGINT UNSIGNED NOT NULL,
  content     TEXT            NOT NULL,
  emoji_meta  JSON            DEFAULT NULL COMMENT '表情统计',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at  DATETIME(3)     DEFAULT NULL,
  KEY idx_doc_created (document_id, created_at),
  KEY idx_parent      (parent_id),
  KEY idx_user        (user_id),
  KEY idx_deleted_at  (deleted_at),
  CONSTRAINT fk_comments_doc    FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id)   REFERENCES doc_document_comments(id),
  CONSTRAINT fk_comments_user   FOREIGN KEY (user_id)     REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档评论';

-- ---------------------------------------------------------
-- 3.2 选字批注（§6.3.9）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_document_annotations;
CREATE TABLE doc_document_annotations (
  id          BIGINT UNSIGNED PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  version_id  BIGINT UNSIGNED DEFAULT NULL COMMENT '关联版本（发布后冻结用）',
  quote_text  VARCHAR(500)    NOT NULL COMMENT '引用的原文',
  content     TEXT            NOT NULL COMMENT '批注内容',
  anchor_data JSON            NOT NULL COMMENT '定位信息（偏移量、段落索引等）',
  status      TINYINT         NOT NULL DEFAULT 1 COMMENT '1未解决 2已解决',
  is_frozen   TINYINT         NOT NULL DEFAULT 0 COMMENT '1已冻结（新版本发布后不可逆）',
  created_by  BIGINT UNSIGNED NOT NULL,
  resolved_by BIGINT UNSIGNED DEFAULT NULL,
  resolved_at DATETIME(3)     DEFAULT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at  DATETIME(3)     DEFAULT NULL,
  KEY idx_doc_version  (document_id, version_id),
  KEY idx_status       (document_id, status),
  KEY idx_created_by   (created_by),
  KEY idx_deleted_at   (deleted_at),
  CONSTRAINT fk_annotations_doc     FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_annotations_version FOREIGN KEY (version_id)  REFERENCES doc_document_versions(id),
  CONSTRAINT fk_annotations_creator FOREIGN KEY (created_by)  REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='选字批注（§6.3.9）';

-- ---------------------------------------------------------
-- 3.3 批注回复
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_annotation_replies;
CREATE TABLE doc_annotation_replies (
  id            BIGINT UNSIGNED PRIMARY KEY,
  annotation_id BIGINT UNSIGNED NOT NULL,
  content       TEXT            NOT NULL,
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at    DATETIME(3)     DEFAULT NULL,
  KEY idx_annotation (annotation_id, created_at),
  KEY idx_created_by (created_by),
  KEY idx_deleted_at (deleted_at),
  CONSTRAINT fk_annotation_replies_ann    FOREIGN KEY (annotation_id) REFERENCES doc_document_annotations(id),
  CONSTRAINT fk_annotation_replies_creator FOREIGN KEY (created_by)   REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='批注回复';

-- =========================================================
-- 4. 审批流
-- =========================================================

-- ---------------------------------------------------------
-- 4.1 审批模板（每组一个，§6.3.2 组设置）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_approval_templates;
CREATE TABLE doc_approval_templates (
  id            BIGINT UNSIGNED PRIMARY KEY,
  group_id      BIGINT UNSIGNED NOT NULL,
  mode          TINYINT         NOT NULL COMMENT '1依次审批 2会签审批',
  timeout_hours INT             NOT NULL DEFAULT 24 COMMENT '超时时间（小时）',
  enabled       TINYINT         NOT NULL DEFAULT 1,
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at    DATETIME(3)     DEFAULT NULL,
  UNIQUE KEY uk_group_deleted (group_id, deleted_at),
  KEY idx_enabled (enabled),
  CONSTRAINT fk_approval_tpl_group   FOREIGN KEY (group_id)   REFERENCES doc_groups(id),
  CONSTRAINT fk_approval_tpl_creator FOREIGN KEY (created_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批模板';

-- ---------------------------------------------------------
-- 4.2 审批模板节点
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_approval_template_nodes;
CREATE TABLE doc_approval_template_nodes (
  id               BIGINT UNSIGNED PRIMARY KEY,
  template_id      BIGINT UNSIGNED NOT NULL,
  order_no         INT             NOT NULL,
  approver_user_id BIGINT UNSIGNED NOT NULL,
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_template_order (template_id, order_no),
  KEY idx_approver (template_id, approver_user_id),
  CONSTRAINT fk_tpl_nodes_template FOREIGN KEY (template_id)      REFERENCES doc_approval_templates(id),
  CONSTRAINT fk_tpl_nodes_approver FOREIGN KEY (approver_user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批模板节点';

-- ---------------------------------------------------------
-- 4.3 审批实例
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_approval_instances;
CREATE TABLE doc_approval_instances (
  id                 BIGINT UNSIGNED PRIMARY KEY,
  biz_type           TINYINT         NOT NULL COMMENT '1文档发布',
  biz_id             BIGINT UNSIGNED NOT NULL COMMENT '关联 doc_document_versions.id',
  document_id        BIGINT UNSIGNED NOT NULL COMMENT '关联文档（方便查询）',
  template_id        BIGINT UNSIGNED DEFAULT NULL,
  mode               TINYINT         NOT NULL COMMENT '1依次审批 2会签审批',
  status             TINYINT         NOT NULL COMMENT '1待审批 2审批中 3已通过 4已驳回 5已撤回',
  initiator_user_id  BIGINT UNSIGNED NOT NULL,
  current_node_order INT             DEFAULT NULL COMMENT '依次审批当前节点序号',
  started_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at        DATETIME(3)     DEFAULT NULL,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_biz_status       (biz_type, biz_id, status),
  KEY idx_document         (document_id),
  KEY idx_initiator_created (initiator_user_id, created_at),
  KEY idx_template         (template_id),
  CONSTRAINT fk_approval_inst_document  FOREIGN KEY (document_id)       REFERENCES doc_documents(id),
  CONSTRAINT fk_approval_inst_template  FOREIGN KEY (template_id)       REFERENCES doc_approval_templates(id),
  CONSTRAINT fk_approval_inst_initiator FOREIGN KEY (initiator_user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批实例';

-- ---------------------------------------------------------
-- 4.4 审批实例节点
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_approval_instance_nodes;
CREATE TABLE doc_approval_instance_nodes (
  id               BIGINT UNSIGNED  PRIMARY KEY,
  instance_id      BIGINT UNSIGNED  NOT NULL,
  node_order       INT              NOT NULL,
  approver_user_id BIGINT UNSIGNED  NOT NULL,
  action_status    TINYINT          NOT NULL DEFAULT 1 COMMENT '1待处理 2通过 3驳回',
  action_comment   VARCHAR(500)     DEFAULT NULL,
  action_at        DATETIME(3)      DEFAULT NULL,
  remind_count     TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已催办次数',
  last_reminded_at DATETIME(3)      DEFAULT NULL,
  created_at       DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_instance_order    (instance_id, node_order),
  KEY idx_approver_status (approver_user_id, action_status),
  CONSTRAINT fk_inst_nodes_instance FOREIGN KEY (instance_id)      REFERENCES doc_approval_instances(id),
  CONSTRAINT fk_inst_nodes_approver FOREIGN KEY (approver_user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批实例节点';

-- =========================================================
-- 5. 业务流转
-- =========================================================

-- ---------------------------------------------------------
-- 5.1 归属人转移（§6.3.10，3天过期）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_ownership_transfers;
CREATE TABLE doc_ownership_transfers (
  id           BIGINT UNSIGNED PRIMARY KEY,
  document_id  BIGINT UNSIGNED NOT NULL,
  from_user_id BIGINT UNSIGNED NOT NULL COMMENT '原归属人',
  to_user_id   BIGINT UNSIGNED NOT NULL COMMENT '目标新归属人',
  status       TINYINT         NOT NULL DEFAULT 1 COMMENT '1待处理 2已同意 3已拒绝 4已过期',
  processed_at DATETIME(3)     DEFAULT NULL COMMENT '处理时间',
  expires_at   DATETIME(3)     NOT NULL COMMENT '过期时间（创建后+3天）',
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_document   (document_id),
  KEY idx_to_user    (to_user_id, status),
  KEY idx_from_user  (from_user_id),
  KEY idx_expires    (status, expires_at),
  CONSTRAINT fk_transfers_doc  FOREIGN KEY (document_id)  REFERENCES doc_documents(id),
  CONSTRAINT fk_transfers_from FOREIGN KEY (from_user_id) REFERENCES doc_users(id),
  CONSTRAINT fk_transfers_to   FOREIGN KEY (to_user_id)   REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='归属人转移请求（§6.3.10）';

-- ---------------------------------------------------------
-- 5.2 跨组移动（§6.3.3 + M12 即时移动 + 异步审核）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_cross_group_moves;
CREATE TABLE doc_cross_group_moves (
  id              BIGINT UNSIGNED PRIMARY KEY,
  document_id     BIGINT UNSIGNED NOT NULL,
  source_group_id BIGINT UNSIGNED NOT NULL,
  target_group_id BIGINT UNSIGNED NOT NULL,
  status          TINYINT         NOT NULL DEFAULT 1 COMMENT '1待确认 2已同意 3已拒绝',
  initiated_by    BIGINT UNSIGNED NOT NULL,
  reviewed_by     BIGINT UNSIGNED DEFAULT NULL COMMENT '目标组负责人',
  reviewed_at     DATETIME(3)     DEFAULT NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_document     (document_id),
  KEY idx_target_group (target_group_id, status),
  KEY idx_initiator    (initiated_by),
  CONSTRAINT fk_moves_doc    FOREIGN KEY (document_id)     REFERENCES doc_documents(id),
  CONSTRAINT fk_moves_source FOREIGN KEY (source_group_id) REFERENCES doc_groups(id),
  CONSTRAINT fk_moves_target FOREIGN KEY (target_group_id) REFERENCES doc_groups(id),
  CONSTRAINT fk_moves_init   FOREIGN KEY (initiated_by)    REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='跨组移动记录';

-- ---------------------------------------------------------
-- 5.3 链接分享（§6.3.8）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_share_links;
CREATE TABLE doc_share_links (
  id          BIGINT UNSIGNED PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  token       VARCHAR(64)     NOT NULL COMMENT '分享令牌（URL 中使用）',
  permission  TINYINT         NOT NULL COMMENT '1可编辑 2可阅读',
  created_by  BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_token (token),
  KEY idx_document (document_id),
  KEY idx_created_by (created_by),
  CONSTRAINT fk_share_links_doc     FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_share_links_creator FOREIGN KEY (created_by)  REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链接分享（§6.3.8）';

-- ---------------------------------------------------------
-- 5.4 权限申请（§6.3.8 M14/M15）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_permission_requests;
CREATE TABLE doc_permission_requests (
  id          BIGINT UNSIGNED PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '申请人',
  type        TINYINT         NOT NULL COMMENT '1申请阅读 2申请编辑',
  reason      VARCHAR(500)    DEFAULT NULL COMMENT '申请理由',
  status      TINYINT         NOT NULL DEFAULT 1 COMMENT '1待处理 2已同意 3已拒绝',
  reviewed_by BIGINT UNSIGNED DEFAULT NULL COMMENT '审批人（文档归属人）',
  reviewed_at DATETIME(3)     DEFAULT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_document (document_id),
  KEY idx_user     (user_id, status),
  KEY idx_reviewer (reviewed_by),
  CONSTRAINT fk_perm_req_doc      FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_perm_req_user     FOREIGN KEY (user_id)     REFERENCES doc_users(id),
  CONSTRAINT fk_perm_req_reviewer FOREIGN KEY (reviewed_by) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限申请（§6.3.8）';

-- ---------------------------------------------------------
-- 5.5 文档引用（§6.10 v2.1 新增，引用=指针非副本）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_document_references;
CREATE TABLE doc_document_references (
  id                 BIGINT UNSIGNED PRIMARY KEY,
  source_document_id BIGINT UNSIGNED NOT NULL COMMENT '源文档ID',
  source_group_id    BIGINT UNSIGNED NOT NULL COMMENT '源组ID',
  target_group_id    BIGINT UNSIGNED NOT NULL COMMENT '目标组ID（引用方）',
  created_by         BIGINT UNSIGNED NOT NULL,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_source_target (source_document_id, target_group_id),
  KEY idx_target_group  (target_group_id),
  KEY idx_source_group  (source_group_id),
  CONSTRAINT fk_refs_source_doc   FOREIGN KEY (source_document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_refs_source_group FOREIGN KEY (source_group_id)    REFERENCES doc_groups(id),
  CONSTRAINT fk_refs_target_group FOREIGN KEY (target_group_id)    REFERENCES doc_groups(id),
  CONSTRAINT fk_refs_creator      FOREIGN KEY (created_by)         REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档引用（§6.10）';

-- =========================================================
-- 6. 通知与日志
-- =========================================================

-- ---------------------------------------------------------
-- 6.1 站内通知（§6.8）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_notifications;
CREATE TABLE doc_notifications (
  id         BIGINT UNSIGNED PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '接收人',
  category   TINYINT         NOT NULL COMMENT '1审批通知(M1-M7) 2系统通知(M8-M17,M24,M25) 3成员变更(M18-M23)',
  msg_code   VARCHAR(10)     DEFAULT NULL COMMENT '消息编号 M1-M25',
  title      VARCHAR(200)    NOT NULL,
  content    VARCHAR(2000)   DEFAULT NULL,
  biz_type   VARCHAR(50)     DEFAULT NULL COMMENT '关联业务类型',
  biz_id     BIGINT UNSIGNED DEFAULT NULL COMMENT '关联业务ID',
  read_at    DATETIME(3)     DEFAULT NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_user_read_created (user_id, read_at, created_at),
  KEY idx_category          (user_id, category),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内通知（§6.8）';

-- ---------------------------------------------------------
-- 6.2 操作日志（仅 INSERT，不可篡改，§6.7）
-- ---------------------------------------------------------
DROP TABLE IF EXISTS doc_operation_logs;
CREATE TABLE doc_operation_logs (
  id            BIGINT UNSIGNED PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NOT NULL COMMENT '操作人（系统操作用 0）',
  action        VARCHAR(100)    NOT NULL COMMENT '如 doc.upload / approval.pass',
  target_type   VARCHAR(50)     NOT NULL COMMENT 'group / document / version / user / approval',
  target_id     BIGINT UNSIGNED DEFAULT NULL,
  group_id      BIGINT UNSIGNED DEFAULT NULL,
  document_id   BIGINT UNSIGNED DEFAULT NULL,
  detail_json   JSON            DEFAULT NULL,
  ip            VARCHAR(64)     DEFAULT NULL,
  user_agent    VARCHAR(500)    DEFAULT NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_actor_time    (actor_user_id, created_at),
  KEY idx_target_time   (target_type, target_id, created_at),
  KEY idx_group_time    (group_id, created_at),
  KEY idx_document_time (document_id, created_at),
  CONSTRAINT fk_logs_actor FOREIGN KEY (actor_user_id) REFERENCES doc_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志（§6.7，仅INSERT）';

-- =========================================================
-- 7. 全文检索索引（可选，不用 ES 时启用）
-- =========================================================
DROP TABLE IF EXISTS doc_search_index_docs;
CREATE TABLE doc_search_index_docs (
  id            BIGINT UNSIGNED PRIMARY KEY,
  document_id   BIGINT UNSIGNED NOT NULL,
  group_id      BIGINT UNSIGNED NOT NULL,
  title         VARCHAR(255)    NOT NULL,
  content_plain MEDIUMTEXT,
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_document_id (document_id),
  FULLTEXT KEY ft_title_content (title, content_plain),
  KEY idx_group_updated (group_id, updated_at),
  CONSTRAINT fk_search_doc   FOREIGN KEY (document_id) REFERENCES doc_documents(id),
  CONSTRAINT fk_search_group FOREIGN KEY (group_id)    REFERENCES doc_groups(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全文检索索引';

-- =========================================================
-- 8. 全局配置
-- =========================================================
DROP TABLE IF EXISTS doc_system_config;
CREATE TABLE doc_system_config (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  config_key   VARCHAR(100)  NOT NULL COMMENT '配置键',
  config_value VARCHAR(2000) NOT NULL COMMENT '配置值',
  description  VARCHAR(300)  DEFAULT NULL,
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全局配置';

INSERT INTO doc_system_config (config_key, config_value, description) VALUES
  ('file_size_limit_mb',      '200',                               '单文件大小上限(MB)'),
  ('allowed_file_types',      '["docx","xlsx","pdf","md","pptx","txt"]', '支持的文件类型'),
  ('version_retention_limit', '50',                                '版本保留数上限'),
  ('approval_timeout_hours',  '24',                                '审批超时默认时间(小时)'),
  ('remind_max_count',        '3',                                 '催办次数上限'),
  ('recycle_bin_days',        '30',                                '回收站自动清理天数');

SET FOREIGN_KEY_CHECKS = 1;
