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
  deleted_at_real, deleted_by_user_id,
  created_by, updated_by, created_at, updated_at, deleted_at
) VALUES
  -- 已发布文档
  (50001, 40004, 10003, 'Alpha项目-技术方案',   'pdf',  4, NULL,  51002, NULL,                              NULL,  10003, 10003, NOW(3), NOW(3), NULL),
  -- 审批中文档
  (50002, 40002, 10003, '研发提测流程规范',      'docx', 3, NULL,  51003, NULL,                              NULL,  10003, 10003, NOW(3), NOW(3), NULL),
  -- 个人草稿（无 group）
  (50003, NULL,  10003, '未命名文档',            'md',   1, NULL,  NULL,  NULL,                              NULL,  10003, NULL,  NOW(3), NOW(3), NULL),
  -- 编辑副本（关联源文档 50001）
  (50004, 40004, 10003, 'Alpha项目-技术方案',   'pdf',  2, 50001, NULL,  NULL,                              NULL,  10003, 10003, NOW(3), NOW(3), NULL),
  -- 回收站样例（status=6，不同组/删除人/时间）
  (50005, 40002, 10003, '[已删]研发规范过期版', 'pdf',  6, NULL,  51004, DATE_SUB(NOW(3), INTERVAL 3 DAY),  10002, 10003, 10002, NOW(3), NOW(3), NULL),
  (50006, 40004, 10003, '[已删]Alpha方案草案',  'docx', 6, NULL,  51006, DATE_SUB(NOW(3), INTERVAL 2 DAY),  10003, 10003, 10003, NOW(3), NOW(3), NULL),
  (50007, 40003, 10003, '[已删]竞品调研-旧版',  'md',   6, NULL,  51007, DATE_SUB(NOW(3), INTERVAL 7 DAY),  10003, 10003, 10003, NOW(3), NOW(3), NULL),
  (50008, 40002, 10006, '[已删]线上问题汇总',   'xlsx', 6, NULL,  51008, DATE_SUB(NOW(3), INTERVAL 1 DAY),  10006, 10006, 10006, NOW(3), NOW(3), NULL),
  (50009, 40001, 10001, '[已删]公司制度-v0.1',  'pdf',  6, NULL,  51009, DATE_SUB(NOW(3), INTERVAL 15 DAY), 10001, 10001, 10001, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  status             = VALUES(status),
  owner_user_id      = VALUES(owner_user_id),
  deleted_at_real    = VALUES(deleted_at_real),
  deleted_by_user_id = VALUES(deleted_by_user_id),
  current_version_id = VALUES(current_version_id),
  updated_at         = NOW(3);

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
   'sha256_demo_rd_v1', 1, JSON_OBJECT('channel', 'web'), '提测流程初版', 10003, NULL, NOW(3), NOW(3), NULL),
  -- 回收站样例版本
  (51004, 50005, 'v1.0', 'docs/deleted/rd-guide-v1.pdf',     'docflow-local',  512000, 'application/pdf',
   'sha256_recycle_50005_v1', 1, JSON_OBJECT('channel', 'web'), '初版',       10002, DATE_SUB(NOW(3), INTERVAL 30 DAY), NOW(3), NOW(3), NULL),
  (51005, 50006, 'v1.0', 'docs/deleted/alpha-draft-v1.docx', 'docflow-local',  128000,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_recycle_50006_v1', 1, JSON_OBJECT('channel', 'web'), '草案',       10003, DATE_SUB(NOW(3), INTERVAL 20 DAY), NOW(3), NOW(3), NULL),
  (51006, 50006, 'v2.0', 'docs/deleted/alpha-draft-v2.docx', 'docflow-local',  160000,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_recycle_50006_v2', 1, JSON_OBJECT('channel', 'web'), '修订',       10003, DATE_SUB(NOW(3), INTERVAL 10 DAY), NOW(3), NOW(3), NULL),
  (51007, 50007, 'v1.0', 'docs/deleted/competitor-v1.md',    'docflow-local',    8192, 'text/markdown',
   'sha256_recycle_50007_v1', 1, JSON_OBJECT('channel', 'web'), '初版',       10003, DATE_SUB(NOW(3), INTERVAL 40 DAY), NOW(3), NOW(3), NULL),
  (51008, 50008, 'v1.0', 'docs/deleted/issue-log-v1.xlsx',   'docflow-local', 2048000,
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   'sha256_recycle_50008_v1', 1, JSON_OBJECT('channel', 'web'), '第一周汇总', 10006, DATE_SUB(NOW(3), INTERVAL 5 DAY),  NOW(3), NOW(3), NULL),
  (51009, 50009, 'v0.1', 'docs/deleted/policy-v0.1.pdf',     'docflow-local', 1048576, 'application/pdf',
   'sha256_recycle_50009_v1', 1, JSON_OBJECT('channel', 'web'), '早期稿',     10001, DATE_SUB(NOW(3), INTERVAL 60 DAY), NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  version_no = VALUES(version_no), file_size = VALUES(file_size), updated_at = NOW(3);

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
-- K.1 审批 seed 补充：系统管理员 (10001) 视角（patch-004 同步）
--     三 Tab 分布：我发起的 4 + 待我审批 8 + 我已处理 5 = 17 条
-- =========================================================
INSERT INTO doc_documents (
  id, group_id, owner_user_id, title, ext, status, source_doc_id, current_version_id,
  deleted_at_real, deleted_by_user_id,
  created_by, updated_by, created_at, updated_at, deleted_at
) VALUES
  -- 我发起的 (10001 initiator)
  (50010, 40001, 10001, '系统审计报告-v1.0',     'pdf',  3, NULL, 51010, NULL, NULL, 10001, 10001, NOW(3), NOW(3), NULL),
  (50011, 40001, 10001, '预算申请-Q2',           'xlsx', 4, NULL, 51011, NULL, NULL, 10001, 10001, NOW(3), NOW(3), NULL),
  (50012, 40001, 10001, '采购申请-办公设备',     'docx', 5, NULL, 51012, NULL, NULL, 10001, 10001, NOW(3), NOW(3), NULL),
  (50013, 40001, 10001, '策略调整方案',           'md',   2, NULL, 51013, NULL, NULL, 10001, 10001, NOW(3), NOW(3), NULL),
  -- 待我审批 (10001 pending approver)
  (50014, 40002, 10002, '研发流程更新-v2',        'docx', 3, NULL, 51014, NULL, NULL, 10002, 10002, NOW(3), NOW(3), NULL),
  (50015, 40002, 10003, '文档规范更新',           'md',   3, NULL, 51015, NULL, NULL, 10003, 10003, NOW(3), NOW(3), NULL),
  (50016, 40002, 10004, '测试标准',                'docx', 3, NULL, 51016, NULL, NULL, 10004, 10004, NOW(3), NOW(3), NULL),
  (50017, 40002, 10005, '质量门禁',                'pdf',  3, NULL, 51017, NULL, NULL, 10005, 10005, NOW(3), NOW(3), NULL),
  (50018, 40003, 10002, '安全策略-v3',            'pdf',  3, NULL, 51018, NULL, NULL, 10002, 10002, NOW(3), NOW(3), NULL),
  (50019, 40003, 10003, 'API 规范',                'md',   3, NULL, 51019, NULL, NULL, 10003, 10003, NOW(3), NOW(3), NULL),
  (50020, 40001, 10006, '新员工手册',              'pdf',  3, NULL, 51020, NULL, NULL, 10006, 10006, NOW(3), NOW(3), NULL),
  (50021, 40001, 10004, '紧急预案',                'docx', 3, NULL, 51021, NULL, NULL, 10004, 10004, NOW(3), NOW(3), NULL),
  -- 我已处理 (10001 handled)
  (50022, 40001, 10002, '年度目标',                'pdf',  4, NULL, 51022, NULL, NULL, 10002, 10002, NOW(3), NOW(3), NULL),
  (50023, 40002, 10003, '岗位晋升申请',            'docx', 4, NULL, 51023, NULL, NULL, 10003, 10003, NOW(3), NOW(3), NULL),
  (50024, 40002, 10002, '跨区调动申请',            'docx', 5, NULL, 51024, NULL, NULL, 10002, 10002, NOW(3), NOW(3), NULL),
  (50025, 40003, 10005, '季度复盘',                'pdf',  4, NULL, 51025, NULL, NULL, 10005, 10005, NOW(3), NOW(3), NULL),
  (50026, 40002, 10004, '版本重构方案',            'md',   5, NULL, 51026, NULL, NULL, 10004, 10004, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  status = VALUES(status), owner_user_id = VALUES(owner_user_id), current_version_id = VALUES(current_version_id), updated_at = NOW(3);

INSERT INTO doc_document_versions (
  id, document_id, version_no, storage_key, storage_bucket, file_size, mime_type,
  checksum, source_type, source_meta, change_note, uploaded_by, published_at,
  created_at, updated_at, deleted_at
) VALUES
  (51010, 50010, 'v1.0', 'docs/approval/audit-v1.pdf',       'docflow-local', 524288, 'application/pdf',
   'sha256_appr_50010_v1', 1, JSON_OBJECT('channel', 'web'), '初版提交审批', 10001, NULL, NOW(3), NOW(3), NULL),
  (51011, 50011, 'v1.0', 'docs/approval/budget-q2.xlsx',     'docflow-local', 204800,
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   'sha256_appr_50011_v1', 1, JSON_OBJECT('channel', 'web'), 'Q2 预算申请', 10001, DATE_SUB(NOW(3), INTERVAL 1 DAY), NOW(3), NOW(3), NULL),
  (51012, 50012, 'v1.0', 'docs/approval/purchase.docx',      'docflow-local', 102400,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_appr_50012_v1', 1, JSON_OBJECT('channel', 'web'), '采购清单', 10001, NULL, NOW(3), NOW(3), NULL),
  (51013, 50013, 'v1.0', 'docs/approval/strategy.md',        'docflow-local',  16384, 'text/markdown',
   'sha256_appr_50013_v1', 1, JSON_OBJECT('channel', 'web'), '策略草案', 10001, NULL, NOW(3), NOW(3), NULL),
  (51014, 50014, 'v2.0', 'docs/approval/rd-flow-v2.docx',    'docflow-local', 307200,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_appr_50014_v1', 1, JSON_OBJECT('channel', 'web'), '流程修订', 10002, NULL, NOW(3), NOW(3), NULL),
  (51015, 50015, 'v1.0', 'docs/approval/doc-spec.md',        'docflow-local',  20480, 'text/markdown',
   'sha256_appr_50015_v1', 1, JSON_OBJECT('channel', 'web'), '规范初版', 10003, NULL, NOW(3), NOW(3), NULL),
  (51016, 50016, 'v1.0', 'docs/approval/test-std.docx',      'docflow-local', 153600,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_appr_50016_v1', 1, JSON_OBJECT('channel', 'web'), '测试标准', 10004, NULL, NOW(3), NOW(3), NULL),
  (51017, 50017, 'v1.0', 'docs/approval/qa-gate.pdf',        'docflow-local', 409600, 'application/pdf',
   'sha256_appr_50017_v1', 1, JSON_OBJECT('channel', 'web'), '质量门禁', 10005, NULL, NOW(3), NOW(3), NULL),
  (51018, 50018, 'v3.0', 'docs/approval/security-v3.pdf',    'docflow-local', 768000, 'application/pdf',
   'sha256_appr_50018_v1', 1, JSON_OBJECT('channel', 'web'), '安全策略升级', 10002, NULL, NOW(3), NOW(3), NULL),
  (51019, 50019, 'v1.0', 'docs/approval/api-spec.md',        'docflow-local',  32768, 'text/markdown',
   'sha256_appr_50019_v1', 1, JSON_OBJECT('channel', 'web'), 'API 约定', 10003, NULL, NOW(3), NOW(3), NULL),
  (51020, 50020, 'v1.0', 'docs/approval/onboarding.pdf',     'docflow-local', 614400, 'application/pdf',
   'sha256_appr_50020_v1', 1, JSON_OBJECT('channel', 'web'), '新员工手册', 10006, NULL, NOW(3), NOW(3), NULL),
  (51021, 50021, 'v1.0', 'docs/approval/emergency.docx',     'docflow-local', 256000,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_appr_50021_v1', 1, JSON_OBJECT('channel', 'web'), '应急预案', 10004, NULL, NOW(3), NOW(3), NULL),
  (51022, 50022, 'v1.0', 'docs/approval/annual-goal.pdf',    'docflow-local', 184320, 'application/pdf',
   'sha256_appr_50022_v1', 1, JSON_OBJECT('channel', 'web'), '年度目标', 10002, DATE_SUB(NOW(3), INTERVAL 2 DAY), NOW(3), NOW(3), NULL),
  (51023, 50023, 'v1.0', 'docs/approval/promotion.docx',     'docflow-local',  81920,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_appr_50023_v1', 1, JSON_OBJECT('channel', 'web'), '晋升申请', 10003, DATE_SUB(NOW(3), INTERVAL 3 DAY), NOW(3), NOW(3), NULL),
  (51024, 50024, 'v1.0', 'docs/approval/transfer.docx',      'docflow-local',  72000,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_appr_50024_v1', 1, JSON_OBJECT('channel', 'web'), '调动申请', 10002, NULL, NOW(3), NOW(3), NULL),
  (51025, 50025, 'v1.0', 'docs/approval/quarterly.pdf',      'docflow-local', 286720, 'application/pdf',
   'sha256_appr_50025_v1', 1, JSON_OBJECT('channel', 'web'), '季度复盘', 10005, DATE_SUB(NOW(3), INTERVAL 5 DAY), NOW(3), NOW(3), NULL),
  (51026, 50026, 'v1.0', 'docs/approval/refactor.md',        'docflow-local',  45056, 'text/markdown',
   'sha256_appr_50026_v1', 1, JSON_OBJECT('channel', 'web'), '重构方案', 10004, NULL, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  version_no = VALUES(version_no), file_size = VALUES(file_size), updated_at = NOW(3);

INSERT INTO doc_approval_instances (
  id, biz_type, biz_id, document_id, template_id, mode, status, initiator_user_id,
  current_node_order, started_at, finished_at, created_at, updated_at
) VALUES
  -- 我发起的
  (62003, 1, 51010, 50010, NULL, 1, 2, 10001, 1,    DATE_SUB(NOW(3), INTERVAL 3 HOUR), NULL,                              DATE_SUB(NOW(3), INTERVAL 3 HOUR), NOW(3)),
  (62004, 1, 51011, 50011, NULL, 1, 3, 10001, NULL, DATE_SUB(NOW(3), INTERVAL 2 DAY),  DATE_SUB(NOW(3), INTERVAL 1 DAY),  DATE_SUB(NOW(3), INTERVAL 2 DAY),  NOW(3)),
  (62005, 1, 51012, 50012, NULL, 1, 4, 10001, NULL, DATE_SUB(NOW(3), INTERVAL 5 DAY),  DATE_SUB(NOW(3), INTERVAL 4 DAY),  DATE_SUB(NOW(3), INTERVAL 5 DAY),  NOW(3)),
  (62006, 1, 51013, 50013, NULL, 1, 5, 10001, NULL, DATE_SUB(NOW(3), INTERVAL 6 HOUR), DATE_SUB(NOW(3), INTERVAL 5 HOUR), DATE_SUB(NOW(3), INTERVAL 6 HOUR), NOW(3)),
  -- 待我审批
  (62007, 1, 51014, 50014, NULL, 1, 2, 10002, 1, DATE_SUB(NOW(3), INTERVAL 10 HOUR), NULL, DATE_SUB(NOW(3), INTERVAL 10 HOUR), NOW(3)),
  (62008, 1, 51015, 50015, NULL, 1, 2, 10003, 1, DATE_SUB(NOW(3), INTERVAL 8 HOUR),  NULL, DATE_SUB(NOW(3), INTERVAL 8 HOUR),  NOW(3)),
  (62009, 1, 51016, 50016, NULL, 1, 2, 10004, 1, DATE_SUB(NOW(3), INTERVAL 6 HOUR),  NULL, DATE_SUB(NOW(3), INTERVAL 6 HOUR),  NOW(3)),
  (62010, 1, 51017, 50017, NULL, 1, 2, 10005, 1, DATE_SUB(NOW(3), INTERVAL 4 HOUR),  NULL, DATE_SUB(NOW(3), INTERVAL 4 HOUR),  NOW(3)),
  (62011, 1, 51018, 50018, NULL, 1, 2, 10002, 1, DATE_SUB(NOW(3), INTERVAL 1 DAY),   NULL, DATE_SUB(NOW(3), INTERVAL 1 DAY),   NOW(3)),
  (62012, 1, 51019, 50019, NULL, 1, 2, 10003, 1, DATE_SUB(NOW(3), INTERVAL 2 DAY),   NULL, DATE_SUB(NOW(3), INTERVAL 2 DAY),   NOW(3)),
  (62013, 1, 51020, 50020, NULL, 1, 2, 10006, 1, DATE_SUB(NOW(3), INTERVAL 3 DAY),   NULL, DATE_SUB(NOW(3), INTERVAL 3 DAY),   NOW(3)),
  (62014, 1, 51021, 50021, NULL, 1, 2, 10004, 1, DATE_SUB(NOW(3), INTERVAL 2 DAY),   NULL, DATE_SUB(NOW(3), INTERVAL 2 DAY),   NOW(3)),
  -- 我已处理
  (62015, 1, 51022, 50022, NULL, 1, 3, 10002, NULL, DATE_SUB(NOW(3), INTERVAL 3 DAY), DATE_SUB(NOW(3), INTERVAL 2 DAY), DATE_SUB(NOW(3), INTERVAL 3 DAY), NOW(3)),
  (62016, 1, 51023, 50023, NULL, 1, 3, 10003, NULL, DATE_SUB(NOW(3), INTERVAL 4 DAY), DATE_SUB(NOW(3), INTERVAL 3 DAY), DATE_SUB(NOW(3), INTERVAL 4 DAY), NOW(3)),
  (62017, 1, 51024, 50024, NULL, 1, 4, 10002, NULL, DATE_SUB(NOW(3), INTERVAL 5 DAY), DATE_SUB(NOW(3), INTERVAL 4 DAY), DATE_SUB(NOW(3), INTERVAL 5 DAY), NOW(3)),
  (62018, 1, 51025, 50025, NULL, 1, 3, 10005, NULL, DATE_SUB(NOW(3), INTERVAL 6 DAY), DATE_SUB(NOW(3), INTERVAL 5 DAY), DATE_SUB(NOW(3), INTERVAL 6 DAY), NOW(3)),
  (62019, 1, 51026, 50026, NULL, 1, 4, 10004, NULL, DATE_SUB(NOW(3), INTERVAL 7 DAY), DATE_SUB(NOW(3), INTERVAL 6 DAY), DATE_SUB(NOW(3), INTERVAL 7 DAY), NOW(3))
ON DUPLICATE KEY UPDATE status = VALUES(status), current_node_order = VALUES(current_node_order), finished_at = VALUES(finished_at), updated_at = NOW(3);

INSERT INTO doc_approval_instance_nodes (
  id, instance_id, node_order, approver_user_id, action_status, action_comment,
  action_at, remind_count, last_reminded_at, created_at, updated_at
) VALUES
  -- 我发起的
  (63005, 62003, 1, 10004, 1, NULL,                         NULL,                             0, NULL,                             DATE_SUB(NOW(3), INTERVAL 3 HOUR), NOW(3)),
  (63006, 62004, 1, 10004, 2, '同意，继续推进',             DATE_SUB(NOW(3), INTERVAL 1 DAY), 0, NULL,                             DATE_SUB(NOW(3), INTERVAL 2 DAY),  NOW(3)),
  (63007, 62005, 1, 10005, 3, '预算超出上限，请缩减后再提', DATE_SUB(NOW(3), INTERVAL 4 DAY), 0, NULL,                             DATE_SUB(NOW(3), INTERVAL 5 DAY),  NOW(3)),
  (63008, 62006, 1, 10004, 1, NULL,                         NULL,                             0, NULL,                             DATE_SUB(NOW(3), INTERVAL 6 HOUR), NOW(3)),
  -- 待我审批（10001 pending）
  (63009, 62007, 1, 10001, 1, NULL, NULL, 0, NULL, DATE_SUB(NOW(3), INTERVAL 10 HOUR), NOW(3)),
  (63010, 62008, 1, 10001, 1, NULL, NULL, 0, NULL, DATE_SUB(NOW(3), INTERVAL 8 HOUR),  NOW(3)),
  (63011, 62009, 1, 10001, 1, NULL, NULL, 0, NULL, DATE_SUB(NOW(3), INTERVAL 6 HOUR),  NOW(3)),
  (63012, 62010, 1, 10001, 1, NULL, NULL, 0, NULL, DATE_SUB(NOW(3), INTERVAL 4 HOUR),  NOW(3)),
  (63013, 62011, 1, 10001, 1, NULL, NULL, 0, NULL, DATE_SUB(NOW(3), INTERVAL 1 DAY),   NOW(3)),
  (63014, 62012, 1, 10001, 1, NULL, NULL, 0, NULL, DATE_SUB(NOW(3), INTERVAL 2 DAY),   NOW(3)),
  (63015, 62013, 1, 10001, 1, NULL, NULL, 0, NULL, DATE_SUB(NOW(3), INTERVAL 3 DAY),   NOW(3)),
  (63016, 62014, 1, 10001, 1, NULL, NULL, 2, DATE_SUB(NOW(3), INTERVAL 1 DAY), DATE_SUB(NOW(3), INTERVAL 2 DAY), NOW(3)),   -- 催办 2 次
  -- 我已处理（10001 approved/rejected）
  (63017, 62015, 1, 10001, 2, '目标清晰，同意',             DATE_SUB(NOW(3), INTERVAL 2 DAY), 0, NULL, DATE_SUB(NOW(3), INTERVAL 3 DAY), NOW(3)),
  (63018, 62016, 1, 10001, 2, '符合晋升条件',               DATE_SUB(NOW(3), INTERVAL 3 DAY), 0, NULL, DATE_SUB(NOW(3), INTERVAL 4 DAY), NOW(3)),
  (63019, 62017, 1, 10001, 3, '人员安排冲突，暂缓处理',     DATE_SUB(NOW(3), INTERVAL 4 DAY), 0, NULL, DATE_SUB(NOW(3), INTERVAL 5 DAY), NOW(3)),
  (63020, 62018, 1, 10001, 2, '复盘完整',                   DATE_SUB(NOW(3), INTERVAL 5 DAY), 0, NULL, DATE_SUB(NOW(3), INTERVAL 6 DAY), NOW(3)),
  (63021, 62019, 1, 10001, 3, '方案细节不足，请补充后再提', DATE_SUB(NOW(3), INTERVAL 6 DAY), 0, NULL, DATE_SUB(NOW(3), INTERVAL 7 DAY), NOW(3))
ON DUPLICATE KEY UPDATE
  action_status = VALUES(action_status),
  action_comment = VALUES(action_comment),
  action_at = VALUES(action_at),
  remind_count = VALUES(remind_count),
  last_reminded_at = VALUES(last_reminded_at),
  updated_at = NOW(3);

-- =========================================================
-- K.2 个人中心 seed 补充：10001 视角 + 离职演示（patch-005 同步）
--     我创建的 额外 8 条 / 分享给我 5 条 / 收藏 5 条 / 10006 离职 + 4 份待交接
-- =========================================================
INSERT INTO doc_documents (
  id, group_id, owner_user_id, title, ext, status, source_doc_id, current_version_id,
  deleted_at_real, deleted_by_user_id,
  created_by, updated_by, created_at, updated_at, deleted_at
) VALUES
  -- 10001 我创建的（8 条）
  (50027, NULL,  10001, '草稿-季度述职报告',    'md',   1, NULL, NULL,  NULL, NULL, 10001, 10001, DATE_SUB(NOW(3), INTERVAL 2 HOUR), DATE_SUB(NOW(3), INTERVAL 30 MINUTE), NULL),
  (50028, NULL,  10001, '草稿-系统架构v3 思路', 'md',   1, NULL, NULL,  NULL, NULL, 10001, 10001, DATE_SUB(NOW(3), INTERVAL 1 DAY),  DATE_SUB(NOW(3), INTERVAL 2 HOUR),   NULL),
  (50029, 40001, 10001, '公司制度-编辑副本',     'md',   2, NULL, 51027, NULL, NULL, 10001, 10001, DATE_SUB(NOW(3), INTERVAL 6 HOUR), DATE_SUB(NOW(3), INTERVAL 1 HOUR),   NULL),
  (50030, 40001, 10001, '年度战略-编辑副本',     'docx', 2, NULL, 51028, NULL, NULL, 10001, 10001, DATE_SUB(NOW(3), INTERVAL 1 DAY),  DATE_SUB(NOW(3), INTERVAL 3 HOUR),   NULL),
  (50031, 40001, 10001, '董事会决议-202604',    'pdf',  4, NULL, 51029, NULL, NULL, 10001, 10001, DATE_SUB(NOW(3), INTERVAL 10 DAY), DATE_SUB(NOW(3), INTERVAL 8 DAY),    NULL),
  (50032, 40001, 10001, '集团组织架构 v1.2',     'pdf',  4, NULL, 51030, NULL, NULL, 10001, 10001, DATE_SUB(NOW(3), INTERVAL 15 DAY), DATE_SUB(NOW(3), INTERVAL 12 DAY),   NULL),
  (50033, 40001, 10001, '员工股权激励办法',      'docx', 4, NULL, 51031, NULL, NULL, 10001, 10001, DATE_SUB(NOW(3), INTERVAL 30 DAY), DATE_SUB(NOW(3), INTERVAL 25 DAY),   NULL),
  (50034, 40001, 10001, '海外办公点方案',        'docx', 5, NULL, 51032, NULL, NULL, 10001, 10001, DATE_SUB(NOW(3), INTERVAL 20 DAY), DATE_SUB(NOW(3), INTERVAL 18 DAY),   NULL),
  -- 10006 离职待交接（4 条）
  (50035, 40002, 10006, '[离职待交接] QA 自动化脚本库', 'md',   4, NULL, 51033, NULL, NULL, 10006, 10006, DATE_SUB(NOW(3), INTERVAL 60 DAY), DATE_SUB(NOW(3), INTERVAL 5 DAY), NULL),
  (50036, 40002, 10006, '[离职待交接] 测试计划-Q1',      'docx', 4, NULL, 51034, NULL, NULL, 10006, 10006, DATE_SUB(NOW(3), INTERVAL 50 DAY), DATE_SUB(NOW(3), INTERVAL 5 DAY), NULL),
  (50037, 40002, 10006, '[离职待交接] 缺陷分析报告',     'xlsx', 4, NULL, 51035, NULL, NULL, 10006, 10006, DATE_SUB(NOW(3), INTERVAL 40 DAY), DATE_SUB(NOW(3), INTERVAL 5 DAY), NULL),
  (50038, NULL,  10006, '[离职待交接] 个人技术笔记',     'md',   1, NULL, NULL,  NULL, NULL, 10006, 10006, DATE_SUB(NOW(3), INTERVAL 30 DAY), DATE_SUB(NOW(3), INTERVAL 5 DAY), NULL)
ON DUPLICATE KEY UPDATE
  status = VALUES(status), owner_user_id = VALUES(owner_user_id), current_version_id = VALUES(current_version_id), updated_at = VALUES(updated_at);

INSERT INTO doc_document_versions (
  id, document_id, version_no, storage_key, storage_bucket, file_size, mime_type,
  checksum, source_type, source_meta, change_note, uploaded_by, published_at,
  created_at, updated_at, deleted_at
) VALUES
  (51027, 50029, 'v1.0', 'docs/profile/policy-v1.md',       'docflow-local',  24576, 'text/markdown',
   'sha256_profile_50029_v1', 1, JSON_OBJECT('channel', 'web'), '公司制度初版', 10001, DATE_SUB(NOW(3), INTERVAL 30 DAY), DATE_SUB(NOW(3), INTERVAL 30 DAY), DATE_SUB(NOW(3), INTERVAL 30 DAY), NULL),
  (51028, 50030, 'v2.0', 'docs/profile/strategy-v2.docx',   'docflow-local', 450000,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_profile_50030_v1', 1, JSON_OBJECT('channel', 'web'), '战略迭代', 10001, DATE_SUB(NOW(3), INTERVAL 40 DAY), DATE_SUB(NOW(3), INTERVAL 40 DAY), DATE_SUB(NOW(3), INTERVAL 40 DAY), NULL),
  (51029, 50031, 'v1.0', 'docs/profile/board-202604.pdf',   'docflow-local', 890000, 'application/pdf',
   'sha256_profile_50031_v1', 1, JSON_OBJECT('channel', 'web'), '董事会决议', 10001, DATE_SUB(NOW(3), INTERVAL 8 DAY),  DATE_SUB(NOW(3), INTERVAL 10 DAY), DATE_SUB(NOW(3), INTERVAL 8 DAY),  NULL),
  (51030, 50032, 'v1.2', 'docs/profile/org-chart-v12.pdf',  'docflow-local', 614400, 'application/pdf',
   'sha256_profile_50032_v1', 1, JSON_OBJECT('channel', 'web'), '组织架构更新', 10001, DATE_SUB(NOW(3), INTERVAL 12 DAY), DATE_SUB(NOW(3), INTERVAL 15 DAY), DATE_SUB(NOW(3), INTERVAL 12 DAY), NULL),
  (51031, 50033, 'v1.0', 'docs/profile/equity-plan.docx',   'docflow-local', 358400,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_profile_50033_v1', 1, JSON_OBJECT('channel', 'web'), '股权激励', 10001, DATE_SUB(NOW(3), INTERVAL 25 DAY), DATE_SUB(NOW(3), INTERVAL 30 DAY), DATE_SUB(NOW(3), INTERVAL 25 DAY), NULL),
  (51032, 50034, 'v1.0', 'docs/profile/overseas-plan.docx', 'docflow-local', 270000,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_profile_50034_v1', 1, JSON_OBJECT('channel', 'web'), '海外拓展', 10001, NULL, DATE_SUB(NOW(3), INTERVAL 20 DAY), DATE_SUB(NOW(3), INTERVAL 20 DAY), NULL),
  (51033, 50035, 'v1.0', 'docs/handover/qa-scripts.md',     'docflow-local',  32768, 'text/markdown',
   'sha256_handover_50035_v1', 1, JSON_OBJECT('channel', 'web'), '自动化脚本', 10006, DATE_SUB(NOW(3), INTERVAL 55 DAY), DATE_SUB(NOW(3), INTERVAL 60 DAY), DATE_SUB(NOW(3), INTERVAL 55 DAY), NULL),
  (51034, 50036, 'v1.0', 'docs/handover/test-plan-q1.docx', 'docflow-local', 260000,
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_handover_50036_v1', 1, JSON_OBJECT('channel', 'web'), 'Q1 测试计划', 10006, DATE_SUB(NOW(3), INTERVAL 45 DAY), DATE_SUB(NOW(3), INTERVAL 50 DAY), DATE_SUB(NOW(3), INTERVAL 45 DAY), NULL),
  (51035, 50037, 'v1.0', 'docs/handover/defects.xlsx',      'docflow-local', 180000,
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   'sha256_handover_50037_v1', 1, JSON_OBJECT('channel', 'web'), '缺陷分析', 10006, DATE_SUB(NOW(3), INTERVAL 35 DAY), DATE_SUB(NOW(3), INTERVAL 40 DAY), DATE_SUB(NOW(3), INTERVAL 35 DAY), NULL)
ON DUPLICATE KEY UPDATE version_no = VALUES(version_no), file_size = VALUES(file_size), updated_at = VALUES(updated_at);

-- 分享给 10001 的文档权限（5 条）
INSERT INTO doc_document_permissions (
  id, document_id, user_id, permission, granted_by, expires_at, created_at, updated_at, deleted_at
) VALUES
  (52010, 50014, 10001, 2, 10002, NULL, DATE_SUB(NOW(3), INTERVAL 2 DAY),  DATE_SUB(NOW(3), INTERVAL 2 DAY),  NULL),
  (52011, 50015, 10001, 1, 10003, NULL, DATE_SUB(NOW(3), INTERVAL 3 DAY),  DATE_SUB(NOW(3), INTERVAL 3 DAY),  NULL),
  (52012, 50018, 10001, 2, 10002, NULL, DATE_SUB(NOW(3), INTERVAL 5 DAY),  DATE_SUB(NOW(3), INTERVAL 5 DAY),  NULL),
  (52013, 50019, 10001, 1, 10003, NULL, DATE_SUB(NOW(3), INTERVAL 7 DAY),  DATE_SUB(NOW(3), INTERVAL 7 DAY),  NULL),
  (52014, 50022, 10001, 2, 10002, NULL, DATE_SUB(NOW(3), INTERVAL 1 DAY),  DATE_SUB(NOW(3), INTERVAL 1 DAY),  NULL)
ON DUPLICATE KEY UPDATE permission = VALUES(permission), updated_at = VALUES(updated_at);

-- 10001 收藏的共享文档（5 条）
INSERT INTO doc_document_favorites (id, document_id, user_id, created_at) VALUES
  (53010, 50001, 10001, DATE_SUB(NOW(3), INTERVAL 2 DAY)),
  (53011, 50002, 10001, DATE_SUB(NOW(3), INTERVAL 4 DAY)),
  (53012, 50014, 10001, DATE_SUB(NOW(3), INTERVAL 6 DAY)),
  (53013, 50019, 10001, DATE_SUB(NOW(3), INTERVAL 8 DAY)),
  (53014, 50025, 10001, DATE_SUB(NOW(3), INTERVAL 10 DAY))
ON DUPLICATE KEY UPDATE document_id = VALUES(document_id);

-- 10006 离职（status=0，演示离职交接给部门负责人 10005）
UPDATE doc_users SET status = 0, updated_at = DATE_SUB(NOW(3), INTERVAL 3 DAY)
WHERE id = 10006;

-- =========================================================
-- L. 站内通知样例（§6.8 / M1-M24 每种 ≥1 条，共 45 条）
--    user_id: 10001-10006（见 A 节）
--    biz_id:  document=50001..50004 / group=40001..40004
--    时间分布近 7 天；约 1/3 未读（read_at IS NULL）
-- =========================================================
INSERT INTO doc_notifications (
  id, user_id, category, msg_code, title, content, biz_type, biz_id, read_at, created_at
) VALUES
  -- ---- 审批类 M1-M7 ----
  (70001, 10004, 1, 'M1',  '文档编辑 提交了文件《研发提测流程规范》的审批，请处理',                          NULL,                             'document', 50002, NULL,                              DATE_SUB(NOW(3), INTERVAL 20 MINUTE)),
  (70002, 10005, 1, 'M2',  '文件《研发提测流程规范》的审批已流转到您（第 2/2 级），请处理',                   NULL,                             'document', 50002, NULL,                              DATE_SUB(NOW(3), INTERVAL 2 HOUR)),
  (70003, 10003, 1, 'M3',  '您提交的文件《Alpha项目-技术方案》已审批通过并发布',                            NULL,                             'document', 50001, DATE_SUB(NOW(3), INTERVAL 1 DAY),   DATE_SUB(NOW(3), INTERVAL 1 DAY)),
  (70004, 10003, 1, 'M4',  '您提交的文件《研发提测流程规范》被驳回，请补充后重新提交',                       '数据不完整，缺少性能对比数据',    'document', 50002, DATE_SUB(NOW(3), INTERVAL 2 DAY),   DATE_SUB(NOW(3), INTERVAL 2 DAY)),
  (70005, 10004, 1, 'M5',  '文件《研发提测流程规范》的审批已超时 48 小时，请尽快处理',                       NULL,                             'document', 50002, NULL,                              DATE_SUB(NOW(3), INTERVAL 6 HOUR)),
  (70006, 10003, 1, 'M6',  '文件《Alpha项目-技术方案》的审批催办已达上限（3 次），您可撤回重新提交',         NULL,                             'document', 50001, DATE_SUB(NOW(3), INTERVAL 3 DAY),   DATE_SUB(NOW(3), INTERVAL 3 DAY)),
  (70007, 10004, 1, 'M7',  '文档编辑 已撤回文件《研发提测流程规范》的审批',                                  NULL,                             'document', 50002, DATE_SUB(NOW(3), INTERVAL 4 DAY),   DATE_SUB(NOW(3), INTERVAL 4 DAY)),
  -- ---- 文档生命周期 M8-M9 ----
  (70008, 10003, 2, 'M8',  '文件《Alpha项目-技术方案》已发布新版本 v1.1',                                    NULL,                             'document', 50001, NULL,                              DATE_SUB(NOW(3), INTERVAL 50 MINUTE)),
  (70009, 10003, 2, 'M9',  '管理员 系统管理员 已将文件《未命名文档》从组《产品资料组》中移除，文档已退回您的个人中心', NULL,                   'document', 50003, DATE_SUB(NOW(3), INTERVAL 2 DAY),   DATE_SUB(NOW(3), INTERVAL 2 DAY)),
  -- ---- 归属人转移 M10-M11 ----
  (70010, 10002, 2, 'M10', '系统管理员 希望将文件《Alpha项目-技术方案》的归属人转移给您，请处理',             NULL,                             NULL,       NULL,  NULL,                              DATE_SUB(NOW(3), INTERVAL 3 HOUR)),
  (70011, 10001, 2, 'M11', '文件《Alpha项目-技术方案》的归属人转移已同意',                                   NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 1 DAY),   DATE_SUB(NOW(3), INTERVAL 1 DAY)),
  -- ---- 跨组移动 M12-M13 ----
  (70012, 10002, 2, 'M12', '文档编辑 申请将文件《Alpha项目-技术方案》从组《Alpha项目组》移动到您负责的组《研发规范组》', NULL,                NULL,       NULL,  NULL,                              DATE_SUB(NOW(3), INTERVAL 4 HOUR)),
  (70013, 10003, 2, 'M13', '文件《Alpha项目-技术方案》的跨组移动申请已同意',                                  NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 2 DAY),   DATE_SUB(NOW(3), INTERVAL 2 DAY)),
  -- ---- 权限申请 M14-M16 ----
  (70014, 10003, 2, 'M14', '普通成员 申请阅读文件《Alpha项目-技术方案》',                                     NULL,                             NULL,       NULL,  NULL,                              DATE_SUB(NOW(3), INTERVAL 5 HOUR)),
  (70015, 10003, 2, 'M15', '普通成员 申请文件《Alpha项目-技术方案》的编辑权限',                               '需要补充技术细节',                NULL,       NULL,  NULL,                              DATE_SUB(NOW(3), INTERVAL 7 HOUR)),
  (70016, 10006, 2, 'M16', '您对文件《Alpha项目-技术方案》的编辑权限申请已同意',                              NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 1 DAY),   DATE_SUB(NOW(3), INTERVAL 1 DAY)),
  -- ---- 分享 M17 ----
  (70017, 10006, 2, 'M17', '文档编辑 向您分享了文件《Alpha项目-技术方案》（可编辑）',                         NULL,                             'document', 50001, NULL,                              DATE_SUB(NOW(3), INTERVAL 30 MINUTE)),
  -- ---- 审批链变更 M24 ----
  (70018, 10002, 2, 'M24', '成员 审批人A 已从组《研发规范组》的审批链中移除（离职），请检查审批配置',           NULL,                             'group_approval', 40002, NULL,                        DATE_SUB(NOW(3), INTERVAL 12 HOUR)),
  -- ---- 成员变更 M18-M23 ----
  (70019, 10006, 3, 'M18', '您已被添加为组《研发规范组》的成员（权限：可编辑）',                              NULL,                             'group',    40002, DATE_SUB(NOW(3), INTERVAL 2 DAY),   DATE_SUB(NOW(3), INTERVAL 2 DAY)),
  (70020, 10006, 3, 'M19', '您在组《Alpha项目组》的权限已从「可编辑」变更为「管理员」',                       NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 3 DAY),   DATE_SUB(NOW(3), INTERVAL 3 DAY)),
  (70021, 10006, 3, 'M20', '您已被移出组《产品资料组》',                                                       NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 5 DAY),   DATE_SUB(NOW(3), INTERVAL 5 DAY)),
  (70022, 10002, 3, 'M21', '您已被部门负责人 系统管理员 指派为部门管理员（研发中心）',                        NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 4 DAY),   DATE_SUB(NOW(3), INTERVAL 4 DAY)),
  (70023, 10003, 3, 'M22', '组《Alpha项目组》的负责人已由 文档编辑 变更为 审批人A',                           NULL,                             'group',    40004, DATE_SUB(NOW(3), INTERVAL 3 DAY),   DATE_SUB(NOW(3), INTERVAL 3 DAY)),
  (70024, 10001, 3, 'M23', '员工 普通成员 已离职，其负责的组《产品资料组》已交接给 文档编辑，请确认',          NULL,                             'group',    40003, NULL,                              DATE_SUB(NOW(3), INTERVAL 8 HOUR)),
  -- ---- 补充样本（让每用户都有若干条） ----
  (70025, 10006, 1, 'M1',  '文档负责人 提交了文件《Alpha项目-技术方案》的审批，请处理',                       NULL,                             'document', 50001, NULL,                              DATE_SUB(NOW(3), INTERVAL 40 MINUTE)),
  (70026, 10006, 1, 'M3',  '您提交的文件《研发提测流程规范》已审批通过并发布',                                NULL,                             'document', 50002, DATE_SUB(NOW(3), INTERVAL 6 DAY),   DATE_SUB(NOW(3), INTERVAL 6 DAY)),
  (70027, 10002, 1, 'M4',  '您提交的文件《Alpha项目-技术方案》被驳回，请补充后重新提交',                      '缺少容量规划章节',                'document', 50001, NULL,                              DATE_SUB(NOW(3), INTERVAL 1 HOUR)),
  (70028, 10001, 2, 'M8',  '文件《研发提测流程规范》已发布新版本 v2.0',                                        NULL,                             'document', 50002, DATE_SUB(NOW(3), INTERVAL 5 DAY),   DATE_SUB(NOW(3), INTERVAL 5 DAY)),
  (70029, 10002, 2, 'M17', '系统管理员 向您分享了文件《Alpha项目-技术方案》（只读）',                         NULL,                             'document', 50001, DATE_SUB(NOW(3), INTERVAL 2 DAY),   DATE_SUB(NOW(3), INTERVAL 2 DAY)),
  (70030, 10001, 3, 'M18', '您已被添加为组《公司文档中心》的成员（权限：管理员）',                            NULL,                             'group',    40001, DATE_SUB(NOW(3), INTERVAL 7 DAY),   DATE_SUB(NOW(3), INTERVAL 7 DAY)),
  (70031, 10002, 3, 'M19', '您在组《研发规范组》的权限已从「可编辑」变更为「管理员」',                         NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 4 DAY),   DATE_SUB(NOW(3), INTERVAL 4 DAY)),
  (70032, 10001, 3, 'M22', '组《产品资料组》的负责人已由 普通成员 变更为 系统管理员',                          NULL,                             'group',    40003, DATE_SUB(NOW(3), INTERVAL 5 DAY),   DATE_SUB(NOW(3), INTERVAL 5 DAY)),
  (70033, 10003, 2, 'M8',  '文件《Alpha项目-技术方案》已发布新版本 v1.2',                                      NULL,                             'document', 50001, NULL,                              DATE_SUB(NOW(3), INTERVAL 10 MINUTE)),
  (70034, 10003, 1, 'M5',  '文件《Alpha项目-技术方案》的审批已超时 24 小时，请尽快处理',                       NULL,                             'document', 50001, NULL,                              DATE_SUB(NOW(3), INTERVAL 3 HOUR)),
  (70035, 10002, 2, 'M14', '普通成员 申请阅读文件《研发提测流程规范》',                                         NULL,                             NULL,       NULL,  NULL,                              DATE_SUB(NOW(3), INTERVAL 9 HOUR)),
  (70036, 10001, 2, 'M11', '文件《研发提测流程规范》的归属人转移已拒绝',                                        NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 1 DAY),   DATE_SUB(NOW(3), INTERVAL 1 DAY)),
  (70037, 10002, 2, 'M13', '文件《Alpha项目-技术方案》的跨组移动申请已过期',                                    NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 3 DAY),   DATE_SUB(NOW(3), INTERVAL 3 DAY)),
  (70038, 10001, 2, 'M16', '您对文件《研发提测流程规范》的阅读权限申请已拒绝',                                  NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 6 DAY),   DATE_SUB(NOW(3), INTERVAL 6 DAY)),
  (70039, 10002, 3, 'M20', '您已被移出组《临时协作组》',                                                        NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 4 DAY),   DATE_SUB(NOW(3), INTERVAL 4 DAY)),
  (70040, 10001, 3, 'M21', '您的系统管理员身份已被撤销',                                                        NULL,                             NULL,       NULL,  DATE_SUB(NOW(3), INTERVAL 10 DAY),  DATE_SUB(NOW(3), INTERVAL 10 DAY)),
  (70041, 10002, 3, 'M23', '员工 审批人B 已离职，其负责的组《研发规范组》已交接给 文档负责人，请确认',           NULL,                             'group',    40002, NULL,                              DATE_SUB(NOW(3), INTERVAL 2 HOUR)),
  (70042, 10002, 1, 'M6',  '文件《研发提测流程规范》的审批催办已达上限（3 次），您可撤回重新提交',              NULL,                             'document', 50002, DATE_SUB(NOW(3), INTERVAL 2 DAY),   DATE_SUB(NOW(3), INTERVAL 2 DAY)),
  (70043, 10006, 1, 'M7',  '系统管理员 已撤回文件《Alpha项目-技术方案》的审批',                                NULL,                             'document', 50001, DATE_SUB(NOW(3), INTERVAL 5 DAY),   DATE_SUB(NOW(3), INTERVAL 5 DAY)),
  (70044, 10001, 2, 'M9',  '管理员 文档负责人 已将文件《未命名文档》从组《产品资料组》中移除，文档已退回您的个人中心', NULL,                     'document', 50003, DATE_SUB(NOW(3), INTERVAL 6 DAY),   DATE_SUB(NOW(3), INTERVAL 6 DAY)),
  (70045, 10002, 2, 'M24', '成员 审批人B 已从组《研发规范组》的审批链中移除（调岗），请检查审批配置',           NULL,                             'group_approval', 40002, DATE_SUB(NOW(3), INTERVAL 1 DAY), DATE_SUB(NOW(3), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE title = VALUES(title), category = VALUES(category), msg_code = VALUES(msg_code), content = VALUES(content), biz_type = VALUES(biz_type), biz_id = VALUES(biz_id), read_at = VALUES(read_at);

-- =========================================================
-- M. 操作日志样例
-- =========================================================
-- detail_json.desc 为预渲染的完整操作描述，后端直接读取（无 desc 时按 action+target 兜底）
-- actor_user_id = 0 代表系统自动触发事件（对应 doc_users 里的 id=0 "系统" 用户）
INSERT INTO doc_operation_logs (
  id, actor_user_id, action, target_type, target_id, group_id, document_id,
  detail_json, ip, user_agent, created_at
) VALUES
  -- 文件上传
  (80001, 10003, 'doc.upload',              'document', 50001, 40004, 50001,
    JSON_OBJECT('desc', '上传文件《Alpha项目-技术方案.md》v1.0', 'version', 'v1.0'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 12 DAY)),
  (80002, 10003, 'doc.upload_version',      'document', 50001, 40004, 50001,
    JSON_OBJECT('desc', '上传文件《Alpha项目-技术方案.md》新版本 v1.1', 'version', 'v1.1'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 10 DAY)),
  (80003, 10003, 'doc.import_feishu',       'document', 50002, 40002, 50002,
    JSON_OBJECT('desc', '从飞书导入文档《研发提测流程规范.md》'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 9 DAY)),

  -- 审批操作
  (80004, 10004, 'approval.submit',         'approval', 62001, 40004, 50001,
    JSON_OBJECT('desc', '提交文件《Alpha项目-技术方案.md》v1.1 的审批'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 8 DAY)),
  (80005, 10004, 'approval.pass',           'approval', 62002, 40004, 50001,
    JSON_OBJECT('desc', '审批通过文件《Alpha项目-技术方案.md》（第 1 级）', 'nodeOrder', 1),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 7 DAY)),
  (80006, 10005, 'approval.pass',           'approval', 62002, 40004, 50001,
    JSON_OBJECT('desc', '审批通过文件《Alpha项目-技术方案.md》（第 2 级）', 'nodeOrder', 2),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 7 DAY)),

  -- 文件发布（系统自动触发，因果溯源指向上一条 approval.pass）
  (80007, 0,     'doc.publish',             'document', 50001, 40004, 50001,
    JSON_OBJECT('desc', '文件《Alpha项目-技术方案.md》v1.1 发布完成', 'version', 'v1.1',
                'triggeredBy', 'approval.pass', 'sourceLogId', 80006),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 7 DAY)),

  -- 文件下载
  (80008, 10006, 'doc.download',            'version',  51002, 40004, 50001,
    JSON_OBJECT('desc', '下载文件《Alpha项目-技术方案.md》v1.1', 'version', 'v1.1'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 6 DAY)),

  -- 文件编辑
  (80009, 10003, 'doc.draft_create',        'document', 50004, 40004, 50001,
    JSON_OBJECT('desc', '创建文件《Alpha项目-技术方案.md》的编辑副本'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 5 DAY)),
  (80010, 10003, 'doc.edit_save',           'document', 50004, 40004, 50001,
    JSON_OBJECT('desc', '自动保存文件《Alpha项目-技术方案.md》的编辑副本', 'trigger', 'autosave'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 5 DAY)),
  (80011, 10003, 'doc.snapshot_create',     'document', 50004, 40004, 50001,
    JSON_OBJECT('desc', '创建命名快照「方案定稿v1」', 'snapshot', '方案定稿v1'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 4 DAY)),

  -- 审批驳回
  (80012, 10004, 'approval.reject',         'approval', 62003, 40002, 50002,
    JSON_OBJECT('desc', '驳回文件《研发提测流程规范.md》的审批，原因：流程图需补充异常分支',
                'reason', '流程图需补充异常分支'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 4 DAY)),

  -- 组织管理
  (80013, 10001, 'group.create',            'group',      40004, 40004, NULL,
    JSON_OBJECT('desc', '创建组「Alpha项目组」'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 15 DAY)),
  (80014, 10001, 'dept.create',             'department', 20001, NULL, NULL,
    JSON_OBJECT('desc', '创建部门「研发中心」'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 20 DAY)),
  (80015, 10001, 'pl.create',               'productline', 30001, NULL, NULL,
    JSON_OBJECT('desc', '创建产品线「DocFlow产品线」'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 18 DAY)),

  -- 成员变更
  (80016, 10003, 'member.add',              'group',    40004, 40004, NULL,
    JSON_OBJECT('desc', '向组「Alpha项目组」添加成员：审批人A', 'memberIds', JSON_ARRAY(10004)),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 14 DAY)),
  (80017, 10003, 'member.remove',           'group',    40002, 40002, NULL,
    JSON_OBJECT('desc', '从组「研发规范组」移除成员：普通成员', 'memberIds', JSON_ARRAY(10006)),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 3 DAY)),

  -- 权限变更
  (80018, 10003, 'permission.group_update', 'group',    40004, 40004, NULL,
    JSON_OBJECT('desc', '修改组「Alpha项目组」中审批人A的权限为「可编辑」', 'userId', 10004, 'role', 2),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 3 DAY)),
  (80019, 10003, 'permission.doc_update',   'document', 50001, 40004, 50001,
    JSON_OBJECT('desc', '设置文件《Alpha项目-技术方案.md》的文档级权限（自定义 2 人）'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 2 DAY)),

  -- 分享
  (80020, 10003, 'share.create',            'document', 50001, 40004, 50001,
    JSON_OBJECT('desc', '为文件《Alpha项目-技术方案.md》创建分享链接（有效期 7 天）', 'expiresInDays', 7),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 2 DAY)),

  -- 收藏置顶
  (80021, 10006, 'favorite.add',            'document', 50001, 40004, 50001,
    JSON_OBJECT('desc', '收藏文件《Alpha项目-技术方案.md》'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 1 DAY)),
  (80022, 10002, 'pin.add',                 'document', 50002, 40002, 50002,
    JSON_OBJECT('desc', '置顶文件《研发提测流程规范.md》到组「研发规范组」'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 1 DAY)),

  -- 文件移除
  (80023, 10003, 'doc.remove',              'document', 50002, 40002, 50002,
    JSON_OBJECT('desc', '从组「研发规范组」移除文件《研发提测流程规范.md》（退回归属人个人中心）'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 6 HOUR)),

  -- 评论批注
  (80024, 10004, 'comment.add',             'document', 50001, 40004, 50001,
    JSON_OBJECT('desc', '在文件《Alpha项目-技术方案.md》添加评论'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 3 HOUR)),
  (80025, 10005, 'annotation.add',          'document', 50001, 40004, 50001,
    JSON_OBJECT('desc', '在文件《Alpha项目-技术方案.md》添加批注（P.2 第 1 段）'),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 2 HOUR)),

  -- 归属人变更
  (80026, 10003, 'ownership.request',       'document', 50001, 40004, 50001,
    JSON_OBJECT('desc', '申请将文件《Alpha项目-技术方案.md》归属人转移给：审批人A', 'targetUserId', 10004),
    '127.0.0.1', 'seed-script', DATE_SUB(NOW(3), INTERVAL 1 HOUR))
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
