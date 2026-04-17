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

### feat: 侧边栏菜单结构对齐原型图 v21
- 调整菜单分组：第一组去掉标题"文档协同"，「个人中心」上移至第一组第2位，「操作日志」移入「系统」组，「通知中心」从侧边栏移除
- 更新图标：共享文档 `Folder`、审批中心 `DocumentChecked`、操作日志 `Document`、系统管理 `Setting`

### design: 组成员管理 — 设计与计划
- 完成组成员管理设计文档 `docs/superpowers/specs/2026-04-16-group-member-management-design.md`
  - A 阶段范围：成员 CRUD + 飞书风格成员选择器（面包屑钻入导航）
  - 5 个后端 API：成员列表/批量添加/修改权限/移除成员/部门用户树
  - 3 个前端组件：MemberSelectorModal、GroupMemberPanel、GroupSettingsModal
  - 用户-部门关联通过 `doc_feishu_users.feishu_department_ids` JSON 字段
- 完成实现计划 `docs/superpowers/plans/2026-04-16-group-member-management.md`
  - 13 个 Task，含完整代码、测试、提交步骤

## 2026-04-17

### feat: 组成员管理 A 阶段落地
- **后端（5 个接口）**
  - `GET /api/groups/:id/members` — 成员列表（按「组负责人 → 管理员 → 加入时间」排序）
  - `POST /api/groups/:id/members` — 批量添加（1-50 人，已存在的 userId 跳过不报错）
  - `PUT /api/groups/:id/members/:memberId` — 修改权限（`immutable_flag=1` 拒绝）
  - `DELETE /api/groups/:id/members/:memberId` — 移除成员（软删除，禁止移除自己 / 不可变成员）
  - `GET /api/users/tree` — 部门 + 部门下用户树（供选择器使用，可选 `groupId` 参数标记已加入）
- **权限**
  - 扩展 `requireMemberPermission`：组内管理员（role=1）也可管理成员
  - 修复 fail() 预设状态码后无法反转的问题：先查组内管理员身份，再回落 scope 校验
- **前端**
  - 新增 `MemberSelectorModal` — 飞书风格选择器（搜索 / 部门钻入面包屑 / 已加入灰显 / 已选面板）
  - 新增 `GroupMemberPanel` — 成员列表（行级权限下拉、移除、组负责人锁定）
  - 新增 `GroupSettingsModal` — 组设置弹窗（审批流配置占位 / 成员管理 / 基本设置三 Tab）
  - `pages/docs/index.vue` 的 `onGroupSettings` 从 stub 改为打开 GroupSettingsModal，保存/删除后自动刷新树与详情
- **规格实现要点**
  - PRD §254 添加成员三元素（飞书成员选择器 + 权限下拉 + 添加按钮）集成在选择器 footer，默认权限「上传下载」
  - 原型 HTML 的 `openMemberSelector` 简化没体现权限下拉，以 PRD 为准
- **样式**
  - `assets/styles/components/_modals.scss` 新增选择器 / 成员面板 / 组设置样式
  - `assets/styles/dark.scss` 增强 primary disabled 按钮对比度（暗色下不再看不清）
  - `DocExplorerPanel` 两个按钮对齐高度（`创建子组` 去 `size="small"`、`进入仓库` 改用固定 `height: 32px`）
- **文档**
  - `docs/api-auth-design.md` 新增 5 个接口说明（§3.34-3.38），后续产品线接口序号递增
  - 设计文档 §4.4 补 PRD §254 溯源注脚
- **测试**
  - 11 条 Zod schema 单元测试（批量 / 边界 / 非法值）

---

## 待开发（按优先级排序）

| 优先级 | 模块 | 状态 |
|--------|------|------|
| P0 | 文档组管理 — 组设置审批流配置 Tab | ⏳ 占位，待开发 |
| P0 | 文档管理核心 — 上传/元数据/版本/状态流转 | ⏳ 待排期 |
| P1 | 组成员管理 B 阶段 — 继承机制 / 负责人移交 | 🕓 待产品讨论 |
| P1 | 审批流 — 模板配置 + 审批操作 | ⏳ 待排期 |
| P1 | 站内通知 — 三类通知 + 已读未读 | ⏳ 待排期 |
| P2 | 操作日志 | ⏳ 待排期 |
| P2 | 回收站 | ⏳ 待排期 |
| P2 | 评论/批注、收藏/置顶、文档引用、搜索、分享 | ⏳ 待排期 |
