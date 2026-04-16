# DocFlow 开发进度追踪

> 记录每次功能开发、修改、修复的内容，便于团队对齐进度。

---

## 2026-04-14

### fix: 根据最新 PRD 文档，更新相关文档
- 对齐 PRD v2.1，更新 `docs/api-auth-design.md`、`docs/feature-gap-checklist.md` 等文档

## 2026-04-16

### feat: 数据库全量重建（对齐 PRD v2.1）
- 重构 `docs/doc.sql` — 全量建表脚本（34 张表），覆盖用户、部门、产品线、文档组、文档、版本、审批、通知、日志等
- 重构 `docs/rbac.sql` — RBAC 权限表 + 角色/权限种子数据（4 角色、27 权限）
- 重构 `docs/doc_seed.sql` — 演示种子数据（6 用户、2 部门、2 产品线、4 组、4 文档、审批/通知/日志样例）
- 清理废弃 SQL 文件：`feishu_users.sql`、`patch-001-config-rbac-remind.sql`、`patch-002-password-hash.sql`

### feat: Prisma 同步
- 执行 `prisma db pull` 从数据库拉取最新 schema（34 模型）
- 执行 `prisma generate` 重新生成 Prisma Client

### feat: 文档组 CRUD + 树结构 + 产品线基础 CRUD
- **后端基础设施**
  - 新增雪花 ID 生成器 `server/utils/snowflake.ts`（53-bit，JS Number 安全）
  - 新增组权限校验工具 `server/utils/group-permission.ts`（按 scope + 角色校验）
  - 新增组/产品线错误码（8 个）
  - 新增 Zod 校验 schema：`server/schemas/group.ts`、`server/schemas/product-line.ts`
  - 新增服务端 DB 行类型 `server/types/group.ts`
- **后端 API（9 个接口）**
  - `GET /api/groups/tree` — 三分类组树查询（公司层/按部门/按产品线）
  - `GET /api/groups/:id` — 组详情
  - `POST /api/groups` — 创建组（自动设负责人+加入成员表）
  - `PUT /api/groups/:id` — 编辑组
  - `DELETE /api/groups/:id` — 删除组（含文件/子组时拒绝）
  - `GET /api/product-lines` — 产品线列表
  - `POST /api/product-lines` — 创建产品线
  - `PUT /api/product-lines/:id` — 编辑产品线
  - `DELETE /api/product-lines/:id` — 删除产品线（含组时拒绝）
- **前端类型 + API 封装**
  - `types/group.ts` — GroupDetail、ProductLineItem 类型
  - `types/doc-nav-tree.ts` — 补充 scopeType/scopeRefId/parentId 字段
  - `api/groups.ts` — 5 个 API 函数
  - `api/product-lines.ts` — 4 个 API 函数
- **前端组件（4 个新组件）**
  - `GroupFormModal.vue` — 组创建/编辑弹窗
  - `ProductLineFormModal.vue` — 产品线创建/编辑弹窗
  - `TreeActionMenu.vue` — 树节点操作菜单（编辑/删除/创建子组等）
  - `DocExplorerPanel.vue` — 右侧面板（按节点类型展示不同内容）
- **页面集成**
  - `pages/docs/index.vue` — 移除全部 mock 数据，接入真实 API + 4 个子组件
- **文档同步更新**
  - `docs/api-auth-design.md` — 补充 9 个新接口文档 + 修正认证相关过时内容
  - `docs/feature-gap-checklist.md` — 更新状态
  - `docs/new-api-guide.md` — 新增 Zod schema 章节

### docs: 更新文档
- 更新 `api-auth-design.md`：补充 refresh/password 接口、组/产品线接口、修正 token 策略
- 更新 `feature-gap-checklist.md`：标记开发中项、补充已完成记录
- 更新 `new-api-guide.md`：新增 Zod schema 校验章节

---

## 待开发（按优先级排序）

| 优先级 | 模块 | 状态 |
|--------|------|------|
| P0 | 文档组管理 — 成员管理 | ⏳ 待排期 |
| P0 | 文档组管理 — 组设置（审批/文件限制） | ⏳ 待排期 |
| P0 | 文档管理核心 — 上传/元数据/版本/状态流转 | ⏳ 待排期 |
| P1 | 审批流 — 模板配置 + 审批操作 | ⏳ 待排期 |
| P1 | 站内通知 — 三类通知 + 已读未读 | ⏳ 待排期 |
| P2 | 操作日志 | ⏳ 待排期 |
| P2 | 回收站 | ⏳ 待排期 |
| P2 | 评论/批注、收藏/置顶、文档引用、搜索、分享 | ⏳ 待排期 |
