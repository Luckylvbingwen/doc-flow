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
  (    0, 'fs_open_system',    NULL,                 '系统',       NULL,                       NULL,          NULL,                                         NULL, 1, NULL,    NOW(3), NOW(3), NULL),
  (10001, 'ou_651958938a1acf3b9dd4f077fd7eb234', 'fs_union_admin',     '系统管理员', 'admin@docflow.local',      '13800000001', 'https://example.com/avatar/admin.png',      NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10002, 'fs_open_owner',     'fs_union_owner',     '文档负责人', 'owner@docflow.local',      '13800000002', 'https://example.com/avatar/owner.png',      NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10003, 'fs_open_editor',    'fs_union_editor',    '文档编辑',   'editor@docflow.local',     '13800000003', 'https://example.com/avatar/editor.png',     NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10004, 'fs_open_reviewer1', 'fs_union_reviewer1', '审批人A',    'reviewer.a@docflow.local', '13800000004', 'https://example.com/avatar/reviewer-a.png', NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10005, 'fs_open_reviewer2', 'fs_union_reviewer2', '审批人B',    'reviewer.b@docflow.local', '13800000005', 'https://example.com/avatar/reviewer-b.png', NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10006, 'fs_open_reader',    'fs_union_reader',    '普通成员',   'reader@docflow.local',     '13800000006', 'https://example.com/avatar/reader.png',     NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10010, 'fs_open_zhangxm',   'fs_union_zhangxm',   '张晓明',     'zhangxm@docflow.local',    '13800000010', 'https://example.com/avatar/zhangxm.png',    NULL, 1, NOW(3), NOW(3), NOW(3), NULL),
  (10013, 'fs_open_lizt',      'fs_union_lizt',      '李已停',     'lizt@docflow.local',       '13800000013', 'https://example.com/avatar/lizt.png',       NULL, 0, NULL,    NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  feishu_open_id  = VALUES(feishu_open_id),
  feishu_union_id = VALUES(feishu_union_id),
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
   'ou_651958938a1acf3b9dd4f077fd7eb234', 'fs_union_admin',     'fs_user_admin',     JSON_ARRAY('feishu_dept_rd', 'feishu_dept_qa'),
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
   NOW(3), NOW(3)),
  (11010, 'zhangxm',   '张晓明',     'zhangxm@docflow.local',    '13800000010', 'https://example.com/avatar/zhangxm.png',    'normal',
   'fs_open_zhangxm',   'fs_union_zhangxm',   'fs_user_zhangxm',   JSON_ARRAY(),
   NOW(3), NOW(3)),
  (11013, 'lizt',      '李已停',     'lizt@docflow.local',       '13800000013', 'https://example.com/avatar/lizt.png',       'hidden',
   'fs_open_lizt',      'fs_union_lizt',      'fs_user_lizt',      JSON_ARRAY(),
   NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  feishu_open_id = VALUES(feishu_open_id),
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
  (30002, 'AI协同产品线',  '智能知识协同方向',       10004, 1, 10001, NOW(3), NOW(3), NULL),
  (30003, '运维产品线',    '平台运维与基础设施方向', 10010, 1, 10001, NOW(3), NOW(3), NULL)
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
-- F / G / H / I / J：业务样例已移除（见 patch-008）
-- 真实使用后会由 UI 操作自然产生（上传/版本/权限/收藏/置顶/评论）；保留骨架即可
-- =========================================================

-- =========================================================
-- K. 审批模板 & 模板节点（保留：组 40004 的依次审批模板 - 给"组设置→审批流配置"一个起手 demo）
--     ⚠️ 审批实例 + 实例节点（62001+、63001+）已移除，真实使用后由上传/提交审批产生
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

-- =========================================================
-- K（续）/ K.1 / K.2 / K.3 / L / M / N：业务数据已移除
--   原 seed 含：审批实例+节点 / 文档+版本 / 个人中心 / cron 演示 / 通知 M1-M24 /
--   操作日志 / 搜索索引。真实使用后由对应 UI 操作自然产生，见 patch-008 清理补丁
-- =========================================================

-- =========================================================
-- O. RBAC 用户-角色分配
-- =========================================================
INSERT INTO sys_user_roles (user_id, role_id, scope_type, scope_ref_id, created_by) VALUES
-- 系统管理员 → super_admin（全局）
(10001, (SELECT id FROM sys_roles WHERE code = 'super_admin'), NULL, NULL, NULL),
-- 文档负责人 → dept_head（研发中心）+ pl_head（DocFlow产品线）
(10002, (SELECT id FROM sys_roles WHERE code = 'dept_head'), 1, 20001, 10001),
(10002, (SELECT id FROM sys_roles WHERE code = 'pl_head'),   2, 30001, 10001),
-- 审批人A → pl_head（AI协同产品线的产品线负责人）
(10004, (SELECT id FROM sys_roles WHERE code = 'pl_head'),   2, 30002, 10001),
-- 审批人B → dept_head（质量保障部）
(10005, (SELECT id FROM sys_roles WHERE code = 'dept_head'), 1, 20002, 10001),
-- 张晓明 → company_admin（全局）+ pl_head（运维产品线 30003）
(10010, (SELECT id FROM sys_roles WHERE code = 'company_admin'), NULL, NULL, 10001),
(10010, (SELECT id FROM sys_roles WHERE code = 'pl_head'),       2,    30003, 10001)
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

SET FOREIGN_KEY_CHECKS = 1;
