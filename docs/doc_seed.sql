-- =========================
-- DocFlow 预制数据（适配 doc_ 前缀表）
-- 用途：本地联调 / 演示环境初始化
-- 导入方式：先执行 docs/doc.sql 建表，再执行本文件
-- =========================

USE docflow;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================
-- A. 核心预制（建议必须有）
-- 1) doc_users：登录/鉴权/操作人强依赖
-- =========================
INSERT INTO doc_users (
  id, feishu_open_id, feishu_union_id, name, email, mobile, avatar_url, status,
  last_login_at, created_at, updated_at, deleted_at
) VALUES
  (10001, 'fs_open_admin', 'fs_union_admin', '系统管理员', 'admin@docflow.local', '13800000001', 'https://example.com/avatar/admin.png', 1, NOW(3), NOW(3), NOW(3), NULL),
  (10002, 'fs_open_owner', 'fs_union_owner', '文档负责人', 'owner@docflow.local', '13800000002', 'https://example.com/avatar/owner.png', 1, NOW(3), NOW(3), NOW(3), NULL),
  (10003, 'fs_open_editor', 'fs_union_editor', '文档编辑', 'editor@docflow.local', '13800000003', 'https://example.com/avatar/editor.png', 1, NOW(3), NOW(3), NOW(3), NULL),
  (10004, 'fs_open_reviewer1', 'fs_union_reviewer1', '审批人A', 'reviewer.a@docflow.local', '13800000004', 'https://example.com/avatar/reviewer-a.png', 1, NOW(3), NOW(3), NOW(3), NULL),
  (10005, 'fs_open_reviewer2', 'fs_union_reviewer2', '审批人B', 'reviewer.b@docflow.local', '13800000005', 'https://example.com/avatar/reviewer-b.png', 1, NOW(3), NOW(3), NOW(3), NULL),
  (10006, 'fs_open_reader', 'fs_union_reader', '只读访客', 'reader@docflow.local', '13800000006', 'https://example.com/avatar/reader.png', 1, NOW(3), NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  feishu_open_id = VALUES(feishu_open_id),
  feishu_union_id = VALUES(feishu_union_id),
  name = VALUES(name),
  email = VALUES(email),
  mobile = VALUES(mobile),
  avatar_url = VALUES(avatar_url),
  status = VALUES(status),
  last_login_at = VALUES(last_login_at),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

-- =========================
-- B. 推荐预制（用于页面联调）
-- doc_departments / doc_product_lines / doc_groups / doc_group_members
-- =========================
INSERT INTO doc_departments (
  id, name, description, owner_user_id, status, created_by, created_at, updated_at, deleted_at
) VALUES
  (20001, '研发中心', '负责平台与业务系统研发', 10002, 1, 10001, NOW(3), NOW(3), NULL),
  (20002, '质量保障部', '负责测试与质量体系建设', 10005, 1, 10001, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  owner_user_id = VALUES(owner_user_id),
  status = VALUES(status),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

INSERT INTO doc_product_lines (
  id, name, description, owner_user_id, status, created_by, created_at, updated_at, deleted_at
) VALUES
  (30001, 'DocFlow产品线', '企业文档管理系统产品线', 10002, 1, 10001, NOW(3), NOW(3), NULL),
  (30002, 'AI协同产品线', '智能知识协同方向', 10004, 1, 10001, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  owner_user_id = VALUES(owner_user_id),
  status = VALUES(status),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

INSERT INTO doc_groups (
  id, parent_id, scope_type, scope_ref_id, name, description,
  owner_user_id, approval_enabled, approval_mode, file_size_limit_mb, file_name_regex,
  status, created_by, created_at, updated_at, deleted_at
) VALUES
  (40001, NULL, 1, NULL, '公司文档中心', '企业级公共文档目录', 10002, 1, 1, 100, '^[A-Za-z0-9_\-\u4e00-\u9fa5\.]+$', 1, 10001, NOW(3), NOW(3), NULL),
  (40002, 40001, 2, 20001, '研发规范组', '研发流程与规范文档', 10002, 1, 1, 100, '^[A-Za-z0-9_\-\u4e00-\u9fa5\.]+$', 1, 10001, NOW(3), NOW(3), NULL),
  (40003, 40001, 3, 30001, '产品资料组', '产品需求与评审资料', 10003, 1, 2, 80, '^[A-Za-z0-9_\-\u4e00-\u9fa5\.]+$', 1, 10001, NOW(3), NOW(3), NULL),
  (40004, 40002, 4, NULL, 'Alpha项目组', 'Alpha项目交付文档', 10003, 1, 1, 50, '^[A-Za-z0-9_\-\u4e00-\u9fa5\.]+$', 1, 10001, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  scope_type = VALUES(scope_type),
  scope_ref_id = VALUES(scope_ref_id),
  name = VALUES(name),
  description = VALUES(description),
  owner_user_id = VALUES(owner_user_id),
  approval_enabled = VALUES(approval_enabled),
  approval_mode = VALUES(approval_mode),
  file_size_limit_mb = VALUES(file_size_limit_mb),
  file_name_regex = VALUES(file_name_regex),
  status = VALUES(status),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

INSERT INTO doc_group_members (
  id, group_id, user_id, role, source_type, immutable_flag, joined_at, created_by, updated_at, deleted_at
) VALUES
  (41001, 40002, 10002, 1, 1, 1, NOW(3), 10001, NOW(3), NULL),
  (41002, 40002, 10003, 2, 1, 0, NOW(3), 10001, NOW(3), NULL),
  (41003, 40002, 10004, 3, 1, 0, NOW(3), 10001, NOW(3), NULL),
  (41004, 40002, 10006, 4, 1, 0, NOW(3), 10001, NOW(3), NULL),
  (41005, 40004, 10003, 1, 1, 1, NOW(3), 10001, NOW(3), NULL),
  (41006, 40004, 10004, 2, 1, 0, NOW(3), 10001, NOW(3), NULL),
  (41007, 40004, 10005, 2, 1, 0, NOW(3), 10001, NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  group_id = VALUES(group_id),
  user_id = VALUES(user_id),
  role = VALUES(role),
  source_type = VALUES(source_type),
  immutable_flag = VALUES(immutable_flag),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

-- =========================
-- C. 可选样例（文档/审批/通知/日志）
-- =========================
INSERT INTO doc_documents (
  id, group_id, title, ext, status, current_version_id, created_by, updated_by,
  created_at, updated_at, deleted_at
) VALUES
  (50001, 40004, 'Alpha项目-技术方案', 'pdf', 3, 51002, 10003, 10003, NOW(3), NOW(3), NULL),
  (50002, 40002, '研发提测流程规范', 'docx', 2, 51003, 10003, 10003, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  group_id = VALUES(group_id),
  title = VALUES(title),
  ext = VALUES(ext),
  status = VALUES(status),
  current_version_id = VALUES(current_version_id),
  updated_by = VALUES(updated_by),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

INSERT INTO doc_document_versions (
  id, document_id, version_no, storage_key, storage_bucket, file_size, mime_type,
  checksum, source_type, source_meta, change_note, uploaded_by, published_at,
  created_at, updated_at, deleted_at
) VALUES
  (51001, 50001, 'v1.0', 'docs/alpha-tech-plan-v1.0.pdf', 'docflow-local', 254312, 'application/pdf',
   'sha256_demo_alpha_v1', 1, JSON_OBJECT('channel', 'web'), '初版提交', 10003, NOW(3), NOW(3), NOW(3), NULL),
  (51002, 50001, 'v1.1', 'docs/alpha-tech-plan-v1.1.pdf', 'docflow-local', 310245, 'application/pdf',
   'sha256_demo_alpha_v1_1', 1, JSON_OBJECT('channel', 'web'), '补充架构图', 10003, NOW(3), NOW(3), NOW(3), NULL),
  (51003, 50002, 'v1.0', 'docs/rd-process-v1.0.docx', 'docflow-local', 145890, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'sha256_demo_rd_v1', 1, JSON_OBJECT('channel', 'web'), '提测流程初版', 10003, NULL, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  document_id = VALUES(document_id),
  version_no = VALUES(version_no),
  storage_key = VALUES(storage_key),
  storage_bucket = VALUES(storage_bucket),
  file_size = VALUES(file_size),
  mime_type = VALUES(mime_type),
  checksum = VALUES(checksum),
  source_type = VALUES(source_type),
  source_meta = VALUES(source_meta),
  change_note = VALUES(change_note),
  uploaded_by = VALUES(uploaded_by),
  published_at = VALUES(published_at),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

INSERT INTO doc_document_permissions (
  id, document_id, user_id, role, granted_by, expires_at, created_at, updated_at, deleted_at
) VALUES
  (52001, 50001, 10006, 3, 10002, NULL, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  document_id = VALUES(document_id),
  user_id = VALUES(user_id),
  role = VALUES(role),
  granted_by = VALUES(granted_by),
  expires_at = VALUES(expires_at),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

INSERT INTO doc_document_favorites (id, document_id, user_id, created_at) VALUES
  (53001, 50001, 10006, NOW(3)),
  (53002, 50001, 10004, NOW(3))
ON DUPLICATE KEY UPDATE
  document_id = VALUES(document_id),
  user_id = VALUES(user_id);

INSERT INTO doc_document_pins (id, document_id, pinned_by, pinned_at) VALUES
  (54001, 50001, 10002, NOW(3))
ON DUPLICATE KEY UPDATE
  document_id = VALUES(document_id),
  pinned_by = VALUES(pinned_by),
  pinned_at = VALUES(pinned_at);

INSERT INTO doc_document_comments (
  id, document_id, user_id, content, emoji_meta, created_at, updated_at, deleted_at
) VALUES
  (55001, 50001, 10004, '方案总体可行，建议补充容灾部分。', JSON_OBJECT('like', 3), NOW(3), NOW(3), NULL),
  (55002, 50001, 10005, '已补充审批意见，建议本周内完成发布。', JSON_OBJECT('thumbs_up', 2), NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  document_id = VALUES(document_id),
  user_id = VALUES(user_id),
  content = VALUES(content),
  emoji_meta = VALUES(emoji_meta),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

INSERT INTO doc_approval_templates (
  id, group_id, mode, timeout_hours, enabled, created_by, created_at, updated_at, deleted_at
) VALUES
  (60001, 40004, 1, 48, 1, 10002, NOW(3), NOW(3), NULL)
ON DUPLICATE KEY UPDATE
  group_id = VALUES(group_id),
  mode = VALUES(mode),
  timeout_hours = VALUES(timeout_hours),
  enabled = VALUES(enabled),
  updated_at = NOW(3),
  deleted_at = VALUES(deleted_at);

INSERT INTO doc_approval_template_nodes (
  id, template_id, order_no, approver_user_id, created_at
) VALUES
  (61001, 60001, 1, 10004, NOW(3)),
  (61002, 60001, 2, 10005, NOW(3))
ON DUPLICATE KEY UPDATE
  template_id = VALUES(template_id),
  order_no = VALUES(order_no),
  approver_user_id = VALUES(approver_user_id);

INSERT INTO doc_approval_instances (
  id, biz_type, biz_id, template_id, mode, status, initiator_user_id,
  current_node_order, started_at, finished_at, created_at, updated_at
) VALUES
  (62001, 1, 51003, 60001, 1, 2, 10003, 1, NOW(3), NULL, NOW(3), NOW(3)),
  (62002, 1, 51002, 60001, 1, 3, 10003, NULL, NOW(3), NOW(3), NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  biz_type = VALUES(biz_type),
  biz_id = VALUES(biz_id),
  template_id = VALUES(template_id),
  mode = VALUES(mode),
  status = VALUES(status),
  initiator_user_id = VALUES(initiator_user_id),
  current_node_order = VALUES(current_node_order),
  started_at = VALUES(started_at),
  finished_at = VALUES(finished_at),
  updated_at = NOW(3);

INSERT INTO doc_approval_instance_nodes (
  id, instance_id, node_order, approver_user_id, action_status, action_comment,
  action_at, created_at, updated_at
) VALUES
  (63001, 62001, 1, 10004, 1, NULL, NULL, NOW(3), NOW(3)),
  (63002, 62001, 2, 10005, 1, NULL, NULL, NOW(3), NOW(3)),
  (63003, 62002, 1, 10004, 2, '同意发布', NOW(3), NOW(3), NOW(3)),
  (63004, 62002, 2, 10005, 2, '同意发布', NOW(3), NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  instance_id = VALUES(instance_id),
  node_order = VALUES(node_order),
  approver_user_id = VALUES(approver_user_id),
  action_status = VALUES(action_status),
  action_comment = VALUES(action_comment),
  action_at = VALUES(action_at),
  updated_at = NOW(3);

INSERT INTO doc_notifications (
  id, user_id, type, title, content, biz_type, biz_id, read_at, created_at
) VALUES
  (70001, 10004, 1, '待审批提醒', '你有一条待审批文档：研发提测流程规范 v1.0', 1, 62001, NULL, NOW(3)),
  (70002, 10005, 1, '审批节点预告', '文档通过第一节点后将流转至你审批', 1, 62001, NULL, NOW(3)),
  (70003, 10003, 2, '系统通知', '你的文档《Alpha项目-技术方案》已发布', 1, 62002, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  type = VALUES(type),
  title = VALUES(title),
  content = VALUES(content),
  biz_type = VALUES(biz_type),
  biz_id = VALUES(biz_id),
  read_at = VALUES(read_at),
  created_at = VALUES(created_at);

INSERT INTO doc_operation_logs (
  id, actor_user_id, action, target_type, target_id, group_id, document_id,
  detail_json, ip, user_agent, created_at
) VALUES
  (80001, 10003, 'doc.upload', 'document', 50001, 40004, 50001, JSON_OBJECT('version', 'v1.1'), '127.0.0.1', 'seed-script', NOW(3)),
  (80002, 10004, 'approval.pass', 'approval', 62002, 40004, 50001, JSON_OBJECT('nodeOrder', 1), '127.0.0.1', 'seed-script', NOW(3)),
  (80003, 10005, 'approval.pass', 'approval', 62002, 40004, 50001, JSON_OBJECT('nodeOrder', 2), '127.0.0.1', 'seed-script', NOW(3))
ON DUPLICATE KEY UPDATE
  actor_user_id = VALUES(actor_user_id),
  action = VALUES(action),
  target_type = VALUES(target_type),
  target_id = VALUES(target_id),
  group_id = VALUES(group_id),
  document_id = VALUES(document_id),
  detail_json = VALUES(detail_json),
  ip = VALUES(ip),
  user_agent = VALUES(user_agent),
  created_at = VALUES(created_at);

INSERT INTO doc_search_index_docs (
  id, document_id, group_id, title, content_plain, updated_at
) VALUES
  (90001, 50001, 40004, 'Alpha项目-技术方案', '本方案覆盖架构设计、交付计划、风险控制与回滚策略。', NOW(3)),
  (90002, 50002, 40002, '研发提测流程规范', '规范提测入口、提测条件、回归策略与发布流程。', NOW(3))
ON DUPLICATE KEY UPDATE
  document_id = VALUES(document_id),
  group_id = VALUES(group_id),
  title = VALUES(title),
  content_plain = VALUES(content_plain),
  updated_at = VALUES(updated_at);

SET FOREIGN_KEY_CHECKS = 1;
