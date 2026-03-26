-- ============================================================
-- DocFlow 飞书集成 — 数据库补丁
-- 参照 task-platform 的 ba_feishu_user 表设计
-- ============================================================

-- 1. 飞书用户表（通讯录镜像）
CREATE TABLE IF NOT EXISTS `doc_feishu_users` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`              VARCHAR(100) NOT NULL DEFAULT '' COMMENT '用户名（英文名 or 拼音）',
  `nickname`              VARCHAR(100) NOT NULL DEFAULT '' COMMENT '昵称（飞书姓名）',
  `email`                 VARCHAR(150) DEFAULT NULL COMMENT '邮箱',
  `mobile`                VARCHAR(32)  DEFAULT NULL COMMENT '手机号',
  `avatar`                VARCHAR(500) DEFAULT NULL COMMENT '飞书头像 URL',
  `status`                ENUM('normal','hidden') NOT NULL DEFAULT 'normal' COMMENT '状态: normal=正常, hidden=离职/冻结',
  `feishu_open_id`        VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '飞书 open_id',
  `feishu_union_id`       VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '飞书 union_id',
  `feishu_user_id`        VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '飞书 user_id',
  `feishu_department_ids` JSON DEFAULT NULL COMMENT '飞书部门 ID 列表',
  `created_at`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_feishu_open_id`  (`feishu_open_id`),
  UNIQUE KEY `uk_feishu_user_id`  (`feishu_user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='飞书用户表（通讯录镜像）';

-- 2. doc_users 增加 feishu_user_id 关联字段（指向 doc_feishu_users.id）
ALTER TABLE `doc_users`
  ADD COLUMN `feishu_user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '关联飞书用户 doc_feishu_users.id' AFTER `feishu_union_id`,
  ADD KEY `idx_feishu_user_id` (`feishu_user_id`);
