-- =============================================================
-- DocFlow 种子数据（适配 PRD v2.1 表结构）
-- 执行顺序：doc.sql → rbac.sql → doc_seed.sql
-- 用途：本地联调 / 演示环境初始化
-- =============================================================

USE docflow;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- A. 用户（6 人，覆盖各角色场景）
-- =========================================================
INSERT INTO doc_users (
  id, feishu_open_id, feishu_union_id, name, email, mobile, avatar_url, password_hash, status,
  last_login_at, created_at, updated_at, deleted_at
) VALUES
  (10001, 'fs_open_admin',     'fs_union_admin',     '系统管理员', 'admin@docflow.local',      '13800000001', 'https://example.com/avatar/admin.png',      NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10002, 'fs_open_owner',     'fs_union_owner',     '文档负责人', 'owner@docflow.local',      '13800000002', 'https://example.com/avatar/owner.png',      NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10003, 'fs_open_editor',    'fs_union_editor',    '文档编辑',   'editor@docflow.local',     '13800000003', 'https://example.com/avatar/editor.png',     NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10004, 'fs_open_reviewer1', 'fs_union_reviewer1', '审批人A',    'reviewer.a@docflow.local', '13800000004', 'https://example.com/avatar/reviewer-a.png', NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10005, 'fs_open_reviewer2', 'fs_union_reviewer2', '审批人B',    'reviewer.b@docflow.local', '13800000005', 'https://example.com/avatar/reviewer-b.png', NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10006, 'fs_open_reader',    'fs_union_reader',    '普通成员',   'reader@docflow.local',     '13800000006', 'https://example.com/avatar/reader.png',     NULL, 1, NOW(3), NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), email = VALUES(email), status = VALUES(status), updated_at = NOW(3);

-- =========================================================
-- A.1 飞书用户（通讯录镜像，供成员选择器 /api/users/tree 使用）
--     feishu_open_id 与 doc_users 对齐；feishu_department_ids 决定用户归属部门
-- =========================================================
INSERT INTO doc_feishu_users (
  id, username, nickname, email, mobile, avatar, status,
  feishu_open_id, feishu_union_id, feishu_user_id, feishu_department_ids,
  created_at, updated_at
) VALUES
  (11001, 'admin',     '系统管理员', 'admin@docflow.local',      '13800000001', 'https://example.com/avatar/admin.png',      'normal',
   'fs_open_admin',     'fs_union_admin',     'fs_user_admin',     JSON_ARRAY('feishu_dept_rd', 'feishu_dept_qa'),
   NOW(3), NOW(3)),
  (11002, 'owner',     '文档负责人', 'owner@docflow.local',      '13800000002', 'https://example.com/avatar/owner.png',      'normal',
   'fs_open_owner',     'fs_union_owner',     'fs_user_owner',     JSON_ARRAY('feishu_dept_rd'),
   NOW(3), NOW(3)),
  (11003, 'editor',    '文档编辑',   'editor@docflow.local',     '13800000003', 'https://example.com/avatar/editor.png',     'normal',
   'fs_open_editor',    'fs_union_editor',    'fs_user_editor',    JSON_ARRAY('feishu_dept_rd'),
   NOW(3), NOW(3)),
  (11004, 'reviewer1', '审批人A',    'reviewer.a@docflow.local', '13800000004', 'https://example.com/avatar/reviewer-a.png', 'normal',
   'fs_open_reviewer1', 'fs_union_reviewer1', 'fs_user_reviewer1', JSON_ARRAY('feishu_dept_rd'),
   NOW(3), NOW(3)),
  (11005, 'reviewer2', '审批人B',    'reviewer.b@docflow.local', '13800000005', 'https://example.com/avatar/reviewer-b.png', 'normal',
   'fs_open_reviewer2', 'fs_union_reviewer2', 'fs_user_reviewer2', JSON_ARRAY('feishu_dept_qa'),
   NOW(3), NOW(3)),
  (11006, 'reader',    '普通成员',   'reader@docflow.local',     '13800000006', 'https://example.com/avatar/reader.png',     'normal',
   'fs_open_reader',    'fs_union_reader',    'fs_user_reader',    JSON_ARRAY('feishu_dept_qa'),
   NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  nickname = VALUES(nickname), email = VALUES(email),
  feishu_department_ids = VALUES(feishu_department_ids), status = VALUES(status), updated_at = NOW(3);

-- =========================================================
-- B. 部门 + 部门管理员
-- =========================================================
INSERT INTO doc_departments (
  id, feishu_department_id, name, description, owner_user_id, status, created_by,
  created_at, updated_at, deleted_at
) VALUES
  (20001, 'feishu_dept_rd', '研发中心',   '负责平台与业务系统研发', 10002, 1, 10001, NOW(3), NOW(3), NULL),
  (20002, 'feishu_dept_qa', '质量保障部', '负责测试与质量体系建设', 10005, 1, 10001, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), owner_user_id = VALUES(owner_user_id), updated_at = NOW(3);

-- 研发中心管理员：审批人A
INSERT INTO doc_department_admins (id, department_id, user_id, created_by, created_at) VALUES
  (21001, 20001, 10004, 10002, NOW(3))
ON DUPLICATE KEY UPDATE department_id = VALUES(department_id);

-- =========================================================
-- C. 产品线 + 产品线管理员
-- =========================================================
INSERT INTO doc_product_lines (
  id, name, description, owner_user_id, status, created_by,
  created_at, updated_at, deleted_at
) VALUES
  (30001, 'DocFlow产品线', '企业文档管理系统产品线', 10002, 1, 10001, NOW(3), NOW(3), NULL),
  (30002, 'AI协同产品线',  '智能知识协同方向',       10004, 1, 10001, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), owner_user_id = VALUES(owner_user_id), updated_at = NOW(3);

-- DocFlow 产品线管理员：文档编辑
INSERT INTO doc_product_line_admins (id, product_line_id, user_id, created_by, created_at) VALUES
  (31001, 30001, 10003, 10002, NOW(3))
ON DUPLICATE KEY UPDATE product_line_id = VALUES(product_line_id);

-- =========================================================
-- D. 文档组（树结构，覆盖三种 scope）
-- =========================================================
INSERT INTO doc_groups (
  id, parent_id, scope_type, scope_ref_id, name, description,
  owner_user_id, approval_enabled, file_size_limit_mb,
  status, created_by, created_at, updated_at, deleted_at
) VALUES
  -- 公司层顶级组
  (40001, NULL,  1, NULL,  '公司文档中心', '企业级公共文档目录',       10002, 1, 100, 1, 10001, NOW(3), NOW(3), NULL),
  -- 部门层组（研发中心下）
  (40002, NULL,  2, 20001, '研发规范组',   '研发流程与规范文档',       10002, 1, 100, 1, 10001, NOW(3), NOW(3), NULL),
  -- 产品线层组（DocFlow 产品线下）
  (40003, NULL,  3, 30001, '产品资料组',   '产品需求与评审资料',       10003, 1,  80, 1, 10001, NOW(3), NOW(3), NULL),
  -- 研发规范组的子组
  (40004, 40002, 2, 20001, 'Alpha项目组',  'Alpha项目交付文档',        10003, 1,  50, 1, 10001, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), owner_user_id = VALUES(owner_user_id), updated_at = NOW(3);

-- =========================================================
-- E. 组成员（role: 1管理员 2可编辑 3上传下载）
-- =========================================================
INSERT INTO doc_group_members (
  id, group_id, user_id, role, source_type, immutable_flag, joined_at, created_by, updated_at, deleted_at
) VALUES
  -- 研发规范组
  (41001, 40002, 10002, 1, 3, 1, NOW(3), 10001, NOW(3), NULL),  -- 部门负责人继承，管理员，不可移除
  (41002, 40002, 10003, 2, 1, 0, NOW(3), 10001, NOW(3), NULL),  -- 可编辑
  (41003, 40002, 10004, 2, 1, 0, NOW(3), 10001, NOW(3), NULL),  -- 可编辑
  (41004, 40002, 10006, 3, 1, 0, NOW(3), 10001, NOW(3), NULL),  -- 上传下载
  -- Alpha 项目组
  (41005, 40004, 10003, 1, 1, 1, NOW(3), 10001, NOW(3), NULL),  -- 组负责人=管理员
  (41006, 40004, 10002, 1, 3, 1, NOW(3), 10001, NOW(3), NULL),  -- 部门负责人继承
  (41007, 40004, 10004, 2, 1, 0, NOW(3), 10001, NOW(3), NULL),  -- 可编辑
  (41008, 40004, 10005, 3, 1, 0, NOW(3), 10001, NOW(3), NULL)   -- 上传下载
ON DUPLICATE KEY UPDATE
  role = VALUES(role), source_type = VALUES(source_type), immutable_flag = VALUES(immutable_flag), updated_at = NOW(3);

-- =========================================================
-- F. 文档样例（status: 1草稿 2编辑中 3审批中 4已发布 5已驳回 6已删除）
-- =========================================================
INSERT INTO doc_documents (
  id, group_id, owner_user_id, title, ext, status, source_doc_id, current_version_id,
  created_by, updated_by, created_at, updated_at, deleted_at
) VALUES
  -- 已发布文档
  (50001, 40004, 10003, 'Alpha项目-技术方案',  'pdf',  4, NULL, 51002, 10003, 10003, NOW(3), NOW(3), NULL),
  -- 审批中文档
  (50002, 40002, 10003, '研发提测流程规范',     'docx', 3, NULL, 51003, 10003, 10003, NOW(3), NOW(3), NULL),
  -- 个人草稿（无 group）
  (50003, NULL,  10003, '未命名文档',           'md',   1, NULL, NULL,  10003, NULL,  NOW(3), NOW(3), NULL),
  -- 编辑副本（关联源文档 50001）
  (50004, 40004, 10003, 'Alpha项目-技术方案',  'pdf',  2, 50001, NULL,  10003, 10003, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  status = VALUES(status), owner_user_id = VALUES(owner_user_id), updated_at = NOW(3);

-- =========================================================
-- G. 文档版本
-- =========================================================
INSERT INTO doc_document_versions (
  id, document_id, version_no, storage_key, storage_bucket, file_size, mime_type,
  checksum, source_type, source_meta, change_note, uploaded_by, published_at,
  created_at, updated_at, deleted_at
) VALUES
  (51001, 50001, 'v1.0', 'docs/alpha-tech-plan-v1.0.pdf', 'docflow-local', 254312, 'application/pdf',
   'sha256_demo_alpha_v1', 1, JSON_OBJECT('channel', 'web'), '初版提交', 10003, NOW(3), NOW(3), NOW(3), NULL),
  (51002, 50001, 'v1.1', 'docs/alpha-tech-plan-v1.1.pdf', 'docflow-local', 310245, 'application/pdf',
   'sha256_demo_alpha_v1_1', 1, JSON_OBJECT('channel', 'web'), '补充架构图', 10003, NOW(3), NOW(3), NOW(3), NULL),
  (51003, 50002, 'v1.0', 'docs/rd-process-v1.0.docx', 'docflow-local', 145890,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_demo_rd_v1', 1, JSON_OBJECT('channel', 'web'), '提测流程初版', 10003, NULL, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  version_no = VALUES(version_no), updated_at = NOW(3);

-- =========================================================
-- H. 文档级权限（permission: 1可编辑 2可阅读）
-- =========================================================
INSERT INTO doc_document_permissions (
  id, document_id, user_id, permission, granted_by, expires_at, created_at, updated_at, deleted_at
) VALUES
  (52001, 50001, 10006, 2, 10002, NULL, NOW(3), NOW(3), NULL)  -- 普通成员对已发布文档可阅读
ON DUPLICATE KEY UPDATE
  permission = VALUES(permission), updated_at = NOW(3);

-- =========================================================
-- I. 收藏 & 置顶
-- =========================================================
INSERT INTO doc_document_favorites (id, document_id, user_id, created_at) VALUES
  (53001, 50001, 10006, NOW(3)),
  (53002, 50001, 10004, NOW(3))
ON DUPLICATE KEY UPDATE document_id = VALUES(document_id);

INSERT INTO doc_document_pins (id, document_id, group_id, pinned_by, pinned_at) VALUES
  (54001, 50001, 40004, 10002, NOW(3))
ON DUPLICATE KEY UPDATE document_id = VALUES(document_id);

-- =========================================================
-- J. 评论
-- =========================================================
INSERT INTO doc_document_comments (
  id, document_id, parent_id, user_id, content, emoji_meta, created_at, updated_at, deleted_at
) VALUES
  (55001, 50001, NULL,  10004, '方案总体可行，建议补充容灾部分。',             JSON_OBJECT('like', 3),       NOW(3), NOW(3), NULL),
  (55002, 50001, NULL,  10005, '已补充审批意见，建议本周内完成发布。',         JSON_OBJECT('thumbs_up', 2),  NOW(3), NOW(3), NULL),
  (55003, 50001, 55001, 10003, '好的，容灾部分已补充到 v1.1 版本。',          NULL,                          NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW(3);

-- =========================================================
-- K. 审批模板 & 实例
-- =========================================================
INSERT INTO doc_approval_templates (
  id, group_id, mode, timeout_hours, enabled, created_by, created_at, updated_at, deleted_at
) VALUES
  (60001, 40004, 1, 48, 1, 10002, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE mode = VALUES(mode), updated_at = NOW(3);

INSERT INTO doc_approval_template_nodes (
  id, template_id, order_no, approver_user_id, created_at
) VALUES
  (61001, 60001, 1, 10004, NOW(3)),
  (61002, 60001, 2, 10005, NOW(3))
ON DUPLICATE KEY UPDATE approver_user_id = VALUES(approver_user_id);

INSERT INTO doc_approval_instances (
  id, biz_type, biz_id, document_id, template_id, mode, status, initiator_user_id,
  current_node_order, started_at, finished_at, created_at, updated_at
) VALUES
  -- 审批中（研发提测流程 v1.0）
  (62001, 1, 51003, 50002, 60001, 1, 2, 10003, 1, NOW(3), NULL, NOW(3), NOW(3)),
  -- 已通过（Alpha 技术方案 v1.1）
  (62002, 1, 51002, 50001, 60001, 1, 3, 10003, NULL, NOW(3), NOW(3), NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW(3);

INSERT INTO doc_approval_instance_nodes (
  id, instance_id, node_order, approver_user_id, action_status, action_comment,
  action_at, remind_count, last_reminded_at, created_at, updated_at
) VALUES
  (63001, 62001, 1, 10004, 1, NULL, NULL, 0, NULL, NOW(3), NOW(3)),
  (63002, 62001, 2, 10005, 1, NULL, NULL, 0, NULL, NOW(3), NOW(3)),
  (63003, 62002, 1, 10004, 2, '同意发布', NOW(3), 0, NULL, NOW(3), NOW(3)),
  (63004, 62002, 2, 10005, 2, '同意发布', NOW(3), 0, NULL, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE action_status = VALUES(action_status), updated_at = NOW(3);

-- =========================================================
-- L. 通知样例
-- =========================================================
INSERT INTO doc_notifications (
  id, user_id, category, msg_code, title, content, biz_type, biz_id, read_at, created_at
) VALUES
  (70001, 10004, 1, 'M1', '待审批提醒',    '文档编辑 提交了文件《研发提测流程规范》的审批，请处理',                1, 62001, NULL,    NOW(3)),
  (70002, 10005, 1, 'M2', '审批流转通知',  '文件《研发提测流程规范》的审批已流转到您（第 2/2 级），请处理',        1, 62001, NULL,    NOW(3)),
  (70003, 10003, 2, 'M3', '审批通过通知',  '您提交的文件《Alpha项目-技术方案》已审批通过并发布',                   1, 62002, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- =========================================================
-- M. 操作日志样例
-- =========================================================
INSERT INTO doc_operation_logs (
  id, actor_user_id, action, target_type, target_id, group_id, document_id,
  detail_json, ip, user_agent, created_at
) VALUES
  (80001, 10003, 'doc.upload',      'document', 50001, 40004, 50001, JSON_OBJECT('version', 'v1.1'),  '127.0.0.1', 'seed-script', NOW(3)),
  (80002, 10004, 'approval.pass',   'approval', 62002, 40004, 50001, JSON_OBJECT('nodeOrder', 1),     '127.0.0.1', 'seed-script', NOW(3)),
  (80003, 10005, 'approval.pass',   'approval', 62002, 40004, 50001, JSON_OBJECT('nodeOrder', 2),     '127.0.0.1', 'seed-script', NOW(3))
ON DUPLICATE KEY UPDATE action = VALUES(action);

-- =========================================================
-- N. 搜索索引样例
-- =========================================================
INSERT INTO doc_search_index_docs (
  id, document_id, group_id, title, content_plain, updated_at
) VALUES
  (90001, 50001, 40004, 'Alpha项目-技术方案',  '本方案覆盖架构设计、交付计划、风险控制与回滚策略。', NOW(3)),
  (90002, 50002, 40002, '研发提测流程规范',     '规范提测入口、提测条件、回归策略与发布流程。',       NOW(3))
ON DUPLICATE KEY UPDATE title = VALUES(title), content_plain = VALUES(content_plain);

-- =========================================================
-- O. RBAC 用户-角色分配
-- =========================================================
INSERT INTO sys_user_roles (user_id, role_id, scope_type, scope_ref_id, created_by) VALUES
-- 系统管理员 → super_admin（全局）
(10001, (SELECT id FROM sys_roles WHERE code = 'super_admin'), NULL, NULL, NULL),
-- 文档负责人 → dept_head（研发中心）+ pl_head（DocFlow产品线）
(10002, (SELECT id FROM sys_roles WHERE code = 'dept_head'), 1, 20001, 10001),
(10002, (SELECT id FROM sys_roles WHERE code = 'pl_head'),   2, 30001, 10001),
-- 审批人A → dept_head（AI协同产品线的产品线负责人）
(10004, (SELECT id FROM sys_roles WHERE code = 'pl_head'),   2, 30002, 10001),
-- 审批人B → dept_head（质量保障部）
(10005, (SELECT id FROM sys_roles WHERE code = 'dept_head'), 1, 20002, 10001)
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

SET FOREIGN_KEY_CHECKS = 1;
