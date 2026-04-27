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

### feat: 操作日志页 A 阶段
- **后端**
  - 新增常量 `server/constants/log-actions.ts` — `LOG_ACTIONS`（UPPER_SNAKE 标识符 → DB 存 `module.verb` 点分小写）、`LOG_TYPES`（PRD §6.7.2 的 14 大类）、`LOG_ACTION_TO_TYPE` / `LOG_TYPE_TO_ACTIONS` 双向映射，文件头写入埋点纪律：一事件一日志、系统自动事件 `actor_user_id=0` + `detail_json.triggeredBy`/`sourceLogId` 溯源
  - 新增 `server/schemas/log.ts` — `logListQuerySchema`（type / keyword / startAt / endAt / page / pageSize，带开始≤结束校验）
  - 新增接口 `GET /api/logs`（服务端分页，`Prisma.sql` 动态 WHERE，JOIN 操作人姓名 + 组名，按 `detail_json.desc` 输出描述，按 created_at DESC 排序）
  - 鉴权：`requirePermission('log:read')`（rbac.sql 已授予 super_admin / company_admin / dept_head / pl_head）
- **前端**
  - 新增 `utils/log-types.ts` — 14 大类 UI 元数据（中文名 + 前景色 + 背景色 + `getLogTypeMeta()`）
  - 新增 `types/log.ts`、`api/logs.ts`
  - 重写 `pages/logs.vue` — 顶部筛选条（类型下拉 / 关键词 / 日期范围 / 重置）+ DataTable（分页/空态复用公共组件）+ 类型标签配色 + 页面级 `log:read` 守卫
  - `layouts/prototype.vue` 菜单项支持 `perm` 字段，按 `useAuth().can()` 过滤，操作日志菜单对无 `log:read` 的用户隐藏
- **数据**
  - `doc_seed.sql` 新增 `id=0` 的「系统」用户（满足 actor_user_id=0 的 FK）
  - 操作日志样例从 3 条扩展到 26 条，覆盖 14 大类代表性 action，含系统触发的 `approval.pass` + `doc.publish` 因果对
- **规格依据**：PRD §6.7.1（日志表格字段 + 筛选）、§6.7.2（14 大类定义）
- **范围**：A 阶段（查询 + 展示）；后续各业务模块按纪律补埋点，即在对应 Handler 里 INSERT `doc_operation_logs` 时写入 `detail_json.desc`
- **测试**：14 条 Zod schema 单测（合法 / 非法 / 边界，含 trim / coerce / 日期比较）

### feat: 组审批流配置 Tab
- **后端**
  - 新增 2 个接口：`GET /api/groups/:id/approval-template`（含兜底默认）+ `PUT /api/groups/:id/approval-template`（整包保存事务）
  - 组创建同事务初始化默认模板：mode=1 依次审批 + 审批人=组负责人 + `approval_enabled=1`
  - 新增错误码：`APPROVAL_APPROVERS_REQUIRED` / `APPROVAL_INVALID_APPROVER`
  - PUT 事务加 P2002 唯一键冲突兜底（返回 409 "审批配置正在被其他人修改，请刷新后重试"）
- **前端**
  - 新增 `GroupApprovalPanel` — 组设置弹窗第一 Tab，包含总开关 / 模式选择（依次/会签卡片） / 审批人列表（上移下移移除，最后一位隐藏移除按钮） / 链路预览 / 保存操作
  - 复用 `MemberSelectorModal`，新增 prop `showRoleSelector`（默认 true；审批人选择场景传 false 隐藏权限下拉）
  - `GroupSettingsModal` 默认 Tab 改为 `'approval'`；dirty 时切 Tab / 关弹窗走 `msgConfirm` 二次确认
- **规格依据**：PRD §243-249（公司层组设置-审批流配置）、§317 / §393（部门 / 产品线组沿用）、§244（默认开启 + 依次 + 组负责人）
- **范围**：A 阶段（模板 CRUD）；不涉及审批实例运行、超时催办、通知，等对应模块再做
- **测试**：12 条 schema 单测（合法 / 边界 / 非法）

---

## 2026-04-18

### feat: 通知中心 A 阶段

- **后端**
  - 新增 4 接口：`GET /api/notifications`（分页）、`GET /api/notifications/unread-count`、`PUT /api/notifications/:id/read`、`PUT /api/notifications/read-all`（可按 category）
  - 鉴权：接口不挂 `requirePermission`，仅以 `event.context.user.id` 过滤 `user_id`（用户只能读/改自己的通知）
  - 新增 `server/utils/notify.ts` — `createNotification` / `createNotifications` helper（INSERT + WS 推 `badge` 未读数）；提取 `pushBadgeToUser` 为导出函数供读端 handler 复用
  - 新增 `server/constants/notification-templates.ts` — M1-M24 强类型模板表，每项含 `category` / `msgCode` / `triggerModule` / `triggerPoint` / `build(params)`
  - 新增 `server/schemas/notification.ts` — 列表 query + read-all body 校验
  - WebSocket 复用 `'badge'` 消息类型，不新增 type
- **前端**
  - 新增 `NotificationBell`（顶栏入口，红角标 99+）+ `NotificationPopover`（380×480，未读/全部 segmented + 近 20 条 + 底部两按钮）+ `NotificationCard`（单条卡片，复用于 Popover 和整页）
  - 重写 `pages/notifications.vue` — 4 Tab（全部/审批/系统/成员变更，带未读角标）+ 只看未读 segment + Pagination 分页
  - 新增 `composables/useNotificationBadge.ts` — 对账逻辑（登录时 + WS 重连时各拉一次 `/unread-count`）
  - `composables/useWs.ts` `open` 事件里动态 import 对账（避免 WS 基础设施硬依赖通知模块）
  - `layouts/prototype.vue` 顶栏插入铃铛
  - 新增 `utils/notification-meta.ts` — `NOTIFICATION_META[msgCode]` 映射 Element Plus 图标+语义色；`resolveRoute` 按 biz_type/biz_id 返回跳转路由
  - 新增 `api/notifications.ts`、`types/notification.ts`
- **样式**
  - `assets/styles/components/_notification.scss`（被 `components.scss` `@forward`）
  - `assets/styles/dark.scss` 追加暗黑适配（未读态用 color-mix 保持可辨识）
- **数据**
  - `doc_seed.sql` L 节从 3 条扩展到 45 条，覆盖 M1-M24 每种 ≥1 条
- **规格依据**：PRD §6.8（站内通知中心）、§1284（通知推送延迟 < 5s）
- **范围**：A 阶段 = 读端 + helper + 模板表；各业务模块触发点接入按 `feature-gap-checklist.md` 「七、通知触发点接入清单」纪律后续补
- **双保险纪律**
  - 代码模板表（`NOTIFICATION_TEMPLATES`）确保业务模块调用契约一致
  - 文档清单表记录 M1-M24 各自归属模块与状态，防止遗漏
- **延迟项**：`/docs/repo/[id].vue` 的 `?openSettings=approval` query 自动打开审批配置 Tab，待 repo 页整合 GroupSettingsModal 时一并实现
- **测试**：13+3=16 条 schema 单测 + 11 条 meta 工具单测

### feat: 回收站 A 阶段（含批量操作）

- **数据库**
  - 新增补丁 `docs/patch-003-recycle-bin.sql`：`doc_documents` 加 `deleted_by_user_id` 字段 + 索引 + FK；新增 3 个权限码 `recycle:read` / `recycle:restore` / `recycle:delete`；授权 super_admin / company_admin / dept_head / pl_head；回收站种子 5 条软删文档 + 对应版本
  - 四地同步：`docs/doc.sql` / `docs/rbac.sql` / `docs/doc_seed.sql` / `prisma/schema.prisma`
  - 更新 `CLAUDE.md` 写入"四地同步纪律"与 patch 可重入要求
- **后端**
  - 新增 Zod schema `server/schemas/recycle-bin.ts`（list / filter-groups / batch ids）
  - 新增错误码 4 个：`RECYCLE_NOT_FOUND` / `RECYCLE_NOT_DELETED` / `RECYCLE_GROUP_MISSING` / `RECYCLE_EXPIRED`
  - 新增 4 个接口 `GET /api/recycle-bin`（列表）/ `GET /api/recycle-bin/filter-groups`（组筛选源）/ `POST /api/recycle-bin/restore`（批量恢复）/ `POST /api/recycle-bin/purge`（批量永久删除）
  - 新增 `server/utils/recycle-scope.ts` — 按角色构造数据范围过滤 `Prisma.Sql`，列表/筛选源/恢复/永删共用
  - 新增 `server/utils/operation-log.ts` — `writeLog` / `writeLogs` 埋点 helper（单条用 create、批量用 createMany，JSON 字段走 `Prisma.InputJsonValue`）
- **前端**
  - 新增 `types/recycle-bin.ts` / `api/recycle-bin.ts`
  - 新增 `components/RemoteSelect.vue` — 远程搜索 + 滚动分页通用下拉（基于 el-select + remote-method + scroll 监听，300ms 防抖，支持泛型）
  - 重写 `pages/recycle-bin.vue` — 按 `logs.vue` 范式（ListPageShell + FilterBar + DataTable fillHeight + `recycle:read` 页面守卫），含多选 + BulkActionBar 批量恢复/永删，行级 / 批量 loading 追踪
  - 扩展 `utils/format.ts` — `formatBytes` 文件大小格式化
- **埋点**：每次恢复/永删成功写一条 `recycle.restore` / `recycle.purge` 操作日志（`detail_json.desc` 预渲染）
- **规格依据**：PRD §6.6（回收站）、§4.3（权限矩阵无回收站行，数据范围按角色自定）
- **范围**：A 阶段 = 读端列表 + 恢复 + 永久删除 + 批量；筛选项仅"关键词 + 原仓库"（PRD §6.6.2 对齐）
- **PRD 外 +**：删除人作为显示列（用户决策，便于管理员追溯）
- **延迟项**：
  1. 查看按钮（PRD §6.6.2"仅展示改版正文"）— 依赖文件上传/预览模块，待其完成后接入
  2. 30 天自动清理 cron
- **测试**：18 条 Zod schema 单测（list / filter-groups / batch 的合法 / 非法 / 边界），全部通过

### refactor: 抽取 useListPage composable + 重构三个现存列表页

- **新增** `composables/useListPage.ts` — 泛型列表页分页/加载/刷新编排
  - 状态：`page` / `pageSize` / `list` / `total` / `loading`
  - 动作：`refresh` / `onFilterChange`（重置 page=1 + 刷新）/ `onPageChange`（保 page + 刷新）/ `onResetFilter`（调页面 `resetFilters` 回调 + 重置 + 刷新）
  - 特性：Race condition 保护（请求自增序号，过时响应丢弃）、immediate 自动首次加载（可关）、defaultPageSize / onError 可定制
  - 边界：不持有 filter ref（由页面声明，在 `buildQuery` 里注入）；不管 columns/slot/selection/行级 loading 等页面级关切
- **认知统一**：auth 跳转冲刷 bug（cookie 跟 accessToken 15m 对齐）修正为**跟 refreshToken 7d 对齐**，SSR 只关心"会话是否存在"，accessToken 过期由 `useAuthFetch` 静默续命。同步更新 `CLAUDE.md` SSR 桥接条目
- **重构三个页面**：
  - `pages/logs.vue` — 去 ~35 行模板代码
  - `pages/recycle-bin.vue` — 去 ~30 行模板代码
  - `pages/notifications.vue` — 去 ~30 行模板代码 + 移除 `watch(onlyUnread)`，改 `el-segmented @change="onFilterChange"`
- **连带修复** `components/DataTable.vue` `data` prop 从 `Record<string, unknown>[]` 放宽到 `Record<string, any>[]`，消除具体业务类型（LogItem/RecycleItem 等）直接传入时的类型不匹配
- **测试**：新增 14 条 `useListPage` 单测（初始状态/默认值/immediate/成功/失败/异常/onError 自定义/筛选&分页&重置语义/Race condition/loading 生命周期），全部通过
- **累计**：Test Files 15 passed，Tests 186 passed

### feat: 审批中心 A 阶段（读端列表 + 撤回）

- **后端**
  - 新增常量 `server/constants/approval.ts`（`APPROVAL_STATUS` 1-5 / `NODE_ACTION` / `CHANGE_TYPE` / `APPROVAL_TABS` / `APPROVAL_FILTERABLE_STATUSES`）
  - 新增 Zod schema `server/schemas/approval.ts`（listQuery：tab 必填 + status 可选 + page/pageSize）
  - 新增错误码 3 个：`APPROVAL_NOT_FOUND` / `APPROVAL_NOT_INITIATOR` / `APPROVAL_NOT_WITHDRAWABLE`
  - 新增接口 `GET /api/approvals` — 按 tab 三路 SQL（pending / submitted / handled），JOIN 文档/版本/组/发起人/当前待审批人，子查询计算"新增/迭代"（`COUNT(versions WHERE id < biz_id)=0`）、当前节点催办次数、所有审批人姓名拼接
  - 新增接口 `POST /api/approvals/:id/withdraw` — 撤回规则校验（必须 initiator=self + status=2），成功后 UPDATE status=5 + 写 `approval.withdraw` 日志
  - 两接口均**不挂** `requirePermission`，仅以 `event.context.user.id` 过滤 —— 与 PRD §4.3 权限矩阵无审批中心行一致，审批面向所有员工
- **前端**
  - 扩展 `types/approval.ts` — 新增 `ApprovalTab` / `ApprovalStatus` / `ApprovalChangeType` / `ApprovalItem` / `ApprovalListQuery`（旧 `ApprovalDetail` 保留给后续 ApprovalDrawer 用）
  - 新增 `api/approvals.ts`（`apiGetApprovals` / `apiWithdrawApproval`）
  - 新增 `utils/approval-meta.ts` — 状态色（5 态）+ 变更类型色（新增绿/迭代蓝）+ `getStatusMeta` / `getChangeTypeMeta`
  - 新增组件 `components/ApprovalListCard.vue` — 卡片式审批项（文件图标 + 标题 + 变更徽章 + 催办徽章 + 次行 group/time/version + 审批人信息 + 驳回原因红底条 + 右侧状态徽章 + [撤回] 按钮）
  - 重写 `pages/approvals.vue` — ListPageShell + TabBar（三 Tab）+ FilterBar（状态筛选，pending tab 自动禁用）+ 卡片列表 + Pagination + 三种空态 preset；用 `useListPage` 编排；撤回走 msgConfirm 二次确认，按行级 `withdrawingId` 追踪 loading
- **规格依据**：PRD §6.4（审批中心 三 Tab）、§6.4.2（列表项字段 / 撤回按钮 / 催办徽章）、§4.3（权限矩阵无审批中心行）
- **范围**：A 阶段 = 读端三 Tab 列表 + 撤回；**不做** ApprovalDrawer 抽屉 / 通过 / 驳回 / 全屏预览 / 全屏对比 / 催办触发定时任务 —— 归后续"审批流运行时"
- **测试**：9 条 Zod schema 单测 + 10 条 approval-meta 单测，全部通过

### feat: 个人中心 A 阶段（5 Tab + 操作矩阵 + 离职交接）

- **后端**
  - 新增常量 `server/constants/personal.ts`（`PERSONAL_TABS` 5 Tab / `PERSONAL_FILTERABLE_STATUSES` 4 态 / `ITEM_SOURCE` 来源 / `PERMISSION_LEVEL`）
  - 新增 Zod schema `server/schemas/personal.ts`（listQuery：tab 必填 + status/keyword/page/pageSize）
  - 新增错误码 4 个：`DRAFT_NOT_FOUND` / `DRAFT_NOT_OWNER` / `DRAFT_NOT_DELETABLE` / `HANDOVER_NOT_DEPT_HEAD`
  - 新增聚合接口 `GET /api/personal/documents` — 按 tab 五路：mine / shared / favorite / all(三路合并去重) / handover(特殊返回 HandoverGroup[])
  - 新增接口 `DELETE /api/documents/:id/draft` — 仅 owner + status=1 可删，软删+写 `doc.draft_delete` 日志
  - 离职移交部门负责人判定：`doc_departments.owner_user_id` / `sys_user_roles.dept_head` / `doc_department_admins` 三者任一
- **前端**
  - 扩展 `types/personal.ts`（PersonalTab / DocStatus / ItemSource / PermissionLevel / PersonalDocItem / HandoverGroup / PersonalListQuery）
  - 新增 `api/personal.ts`（`apiGetPersonalDocs` 普通 tab / `apiGetPersonalHandover` 离职移交 / `apiDeleteDraft`）
  - 新增 `utils/doc-meta.ts` — 文档状态色 + 来源徽章色 + 权限级别色（可跨页面复用）
  - 新增 `utils/personal-matrix.ts` — 操作矩阵 `getActions(doc, userId)`，A 阶段只返回 `view` / `withdraw` / `delete`，其他 6 种按钮直接隐藏
  - 新增 `utils/file-type.ts` — `getFileTypeClass` / `getFileTypeLabel` 抽公共（回收站/审批/离职交接均可复用，本轮替换了 HandoverAccordion、profile 两处内联实现）
  - 新增组件 `components/HandoverAccordion.vue` — 离职交接手风琴（头像+姓名+部门+离职日期+文件数 badge；展开内嵌文档卡片）
  - 重写 `pages/profile.vue`（449 行 mock → 新版）：ListPageShell + TabBar(5 Tab) + FilterBar(状态/关键词) + DataTable(普通 tab) + HandoverAccordion(离职移交 tab) + `useListPage` 编排（handover 单独走专用 fetch 规避联合类型）
- **Seed（patch-005 + 同步 doc_seed.sql）**
  - 10001 我创建的：补 8 条（草稿 2 + 编辑中 2 + 已发布 3 + 已驳回 1），叠加原有 5 条 → 13 条
  - 10001 分享给我的：5 条（10002/10003 分享，混合可编辑/可阅读）
  - 10001 收藏：5 条
  - 10006 离职演示：`doc_users.status=0`，名下 4 份"待交接"文档（3 已发布 + 1 草稿），归属 `feishu_dept_qa`（质量保障部）；登录审批人 B（10005，该部门 dept_head）可在"离职移交"Tab 看到
- **规格依据**：PRD §6.5（个人中心）全节 + §6.5.3（离职交接）
- **范围**：A 阶段 = 5 Tab 读端 + 撤回提示跳转 + 删除草稿；**不做** 编辑 / 分享 / 下载 / 提交发布 / 转移归属人 / 申请编辑权限（全部依赖后续模块）
- **注意事项**：当前页拆掉了原 mock 的"用户信息卡/编辑资料/修改密码/安全设置"—— PRD 没要求；若后续需要"账号设置"建议放到顶栏用户下拉而非个人中心内
- **测试**：11 条 Zod schema 单测 + 12 条 personal-matrix 单测，全部通过

---

## 2026-04-20

### feat: 系统管理页面 A 阶段（§6.9）+ 飞书同步扩展

- **飞书同步扩展**（对齐 PRD §327 全员预落地）
  - `server/utils/feishu.ts` `feishuSyncContacts` 扩展 3 步：upsert `doc_departments`（按 `feishu_department_id` 幂等）/ upsert `doc_users`（按 `feishu_open_id` 幂等，§327）/ 部门主管 `leader_user_id` 识别后写 `doc_departments.owner_user_id` + 幂等授予 `dept_head` 角色（`sys_user_roles` scope=部门 id）
  - `server/types/feishu.ts` 扩展 `FeishuDept.leader_user_id` + `FeishuSyncResult` 新增 `deptCreated / deptUpdated / docUserCreated / docUserUpdated / deptHeadAssigned` 5 个统计字段
  - `server/api/auth/feishu/callback.post.ts` 修复历史 bug：doc_users 表没有 `feishu_user_id` 字段（doc.sql 重构时删了），callback 的 SQL 引用该字段会报错导致飞书登录一路挂；改为按 `feishu_open_id` 单字段关联；兜底建档的 `Date.now()` 改用雪花 ID

- **业务层系统管理页面**（对齐 PRD §6.9.2）
  - 后端 `GET /api/admin/users` — 多角色聚合（GROUP_CONCAT）+ 产品线/部门归属批量反查 + 权重排序（CASE WHEN MIN）+ keyword / roles[]（支持 `none`）/ status 筛选
  - 后端 `PUT /api/admin/users/:id/roles` — 整包指派 `companyAdmin` / `plHead`；super_admin 受保护；取消 `pl_head` 时若仍是任何产品线 owner → 409 `ADMIN_PL_HEAD_HAS_OWNERSHIP`；事务内增删；埋点 `admin.role_assign`
  - 后端 `POST/PUT /api/product-lines` 事务内自动补 owner 的 `pl_head` 角色（与 `owner_user_id` 保持一致）
  - 新增 `server/utils/system-role.ts` helper — `grantRole` / `revokeRole` / `hasRole` / `countProductLinesOwnedBy`，`UNIQUE (user_id, role_id, scope_type, scope_ref_id)` 保证幂等
  - 新增错误码 3 个：`ADMIN_SUPER_ADMIN_PROTECTED` / `ADMIN_PL_HEAD_HAS_OWNERSHIP` / `ADMIN_DEPT_HEAD_SYNC_ONLY`
  - 新增 log action `admin.role_assign`（归入 `permission` 类）
  - 新增权限码 `admin:user_read` / `admin:role_assign` 授给 super_admin

- **前端**
  - 重写 `pages/admin.vue` — 去 TabBar，改纯用户列表（ListPageShell + FilterBar + DataTable + 底部蓝色说明条 + 页面级 `admin:user_read` 守卫跳 `/docs`）；系统管理员行显示"系统预设"、已停用行显示"停用时间"并行级降透明度、`admin:role_assign` 下显示「角色管理」按钮；停用按钮显示但点击 toast `功能开发中`（B 阶段做离职交接）
  - 新增 `components/admin/AdminRoleAssignModal.vue` — 双卡片 checkbox（公司层管理员 / 产品线负责人）；产品线负责人卡片展开只读 tag 列表（反查 `doc_product_lines.owner_user_id`）；取消 pl_head 前 `msgConfirm` 二次确认
  - 新增 `utils/system-role-meta.ts` — 角色 badge 色值对齐原型 v21（红/黄/靛蓝/蓝+飞书小标签）
  - 新增 `types/admin.ts` + `api/admin.ts`

- **框架层 RBAC 页面拆分（为抽离 starter 准备）**
  - 新建 `pages/system/roles.vue` + `pages/system/user-roles.vue`（原 `components/admin/RoleManager.vue` / `UserRoleManager.vue` 的逻辑搬进 page）
  - 删除 `components/admin/RoleManager.vue` / `components/admin/UserRoleManager.vue`
  - `layouts/prototype.vue` 两条 `/system/*` 菜单项保留**注释态**，标注"抽离 starter 时启用"；DocFlow 业务不暴露此入口，页面仍可通过直接访问 URL 或抽离后启用菜单看到

- **数据**
  - `docs/patch-006-admin-system-management.sql` — 权限码 + super_admin 关联 + 新增演示用户 10010 张晓明（company_admin + pl_head）+ 10013 李已停（status=0）+ 新增产品线 30003（10010 为 owner）+ 对应角色分配
  - 四地同步：`rbac.sql` 权限段 / `doc_seed.sql` A / A.1 / C / O 四个段落
  - `doc_seed.sql` 的 `doc_users` / `doc_feishu_users` 的 `ON DUPLICATE KEY UPDATE` 子句补上 `feishu_open_id` / `feishu_union_id`，保证开发期 seed 可重入地"治愈"旧 open_id

- **规格依据**：PRD §6.9（系统管理 / 角色权限）§327（全员预落地）§357（产品线负责人由系统管理员指派）§4.1（角色定义表）

- **范围**：A 阶段 = 用户列表读端 + 角色指派（公司层管理员 / 产品线负责人）；**不做** 停用按钮功能 / 离职文档交接 / 重新启用 — 归 B 阶段

- **延迟项**
  1. 停用用户 + 离职文档交接流程（PRD §325 / §6.5.3） — 依赖"离职交接运行时"整体设计
  2. 飞书人员移除的自动清空组成员 + 组负责人自动交接（PRD §325）

- **测试**：Zod schema + utils 相关单元测试由下一轮补齐（见遗留项）

---

## 2026-04-24

### feat: 文档核心 A 阶段（MinIO + storage 管线 + 上传/版本/详情/下载/预览/移除 + 审批运行时起审批/通过/驳回 + 前端接入）

见提交 `81229ca`。同日 A 阶段一并落地：M1/M2/M3/M4/M7/M8/M9 通知触发点接入、APPROVAL_SUBMIT/PASS/REJECT/WITHDRAW + DOC_PUBLISH 日志埋点、驳回意见必填（Zod + 前端红字提示）、ApprovalDrawer 变更摘要 `/api/version/compare` 调用。

### feat: 审批超时催办 B 阶段（M5/M6 + cron）

- **数据 / 工具层**
  - `server/constants/log-actions.ts` 追加 `approval.remind` / `approval.remind_limit`，归 `approval` 类（14 大类映射表同步）
  - `server/utils/system-config.ts` 新增 — `getSystemConfig` / `getSystemConfigNumber` / `invalidateSystemConfigCache`，进程内 5 分钟缓存，DB 异常时回退 default + pino warn
  - `docs/patch-007-approval-timeout-reminder.sql` 新增 — 2 条 cron 演示 seed（可重入，ON DUPLICATE KEY UPDATE 会刷新 started_at / last_reminded_at / remind_count 回初始态）：
    - 50032 `Cron 演示·刚超时 25h`：owner 10002 / 审批人 10004，remind_count=0，first M5 场景
    - 50033 `Cron 演示·达催办上限`：owner 10002 / 审批人 10005，remind_count=3 且 last_reminded_at=25h 前，M6 场景
  - 四地同步：`docs/doc_seed.sql` 补 K.3 段
- **cron 主体**
  - `server/tasks/approval/remind-timeout.ts` — Nitro task，每整点扫描超时 pending 节点
  - `nuxt.config.ts` scheduledTasks 追加 `'0 * * * *': ['approval:remind-timeout']`
  - 扫描 SQL 一次性 JOIN `instance + doc + template + prev-node`，无 N+1
  - **节点起算口径**：`node_order=1` 用 `inst.started_at`；`>1` 用前级 `action_at`。每个审批人从"球踢到自己这儿"开始有完整 `timeout_hours`，避免多级审批后级被挤压
  - **通用判定**：`COALESCE(last_reminded_at, <node_start>) + timeout_hours <= NOW(3)`。`timeout_hours` 从 `doc_approval_templates` 取，模板不存在走 `COALESCE(24)` 兜底
  - **状态机**：
    - `remind_count < max` → 发 M5 给当前审批人，`count++`
    - `remind_count === max` → 发 M6 给提交人，`count++`（哨兵态）
    - `remind_count > max` → SQL WHERE 已过滤，不再处理
  - **乐观锁**：`updateMany({ where: { id, remind_count: 旧值 } })`，并发下多进程同扫只有一个成功，另一方 `count !== 1` 静默 skip
  - 单节点 try/catch 独立失败，批次继续；task 返回 `{ scanned, m5, m6, skipped }` 写 Nitro 日志
- **规格依据**：PRD §6.4（审批中心）+ `doc_system_config.remind_max_count=3` / `approval_timeout_hours=24`
- **范围**：B 阶段 = M5/M6 超时催办；**不做** 超时后自动撤回（PRD "您可撤回重新提交"由提交人主动）/ M24 审批链成员因离职调岗移除（依赖"离职交接运行时"整体设计，归后续）
- **文档同步**
  - `docs/feature-gap-checklist.md` §2.1 审批管理 5 项打 ✅（抽屉 / 审批链 / 驳回必填 / 变更摘要 / 催办 cron）；§七、通知触发清单 M1-M9 全部打 ✅ 2026-04-24
  - `docs/superpowers/specs/2026-04-24-approval-timeout-reminder-design.md` / `docs/superpowers/plans/2026-04-24-approval-timeout-reminder.md` 新增

### feat: 收藏 / 置顶 B 阶段（写端闭环 + UI + 级联清理）

A 阶段已就绪：表 `doc_document_favorites` / `doc_document_pins`、4 个 log action 常量、读端 JOIN 返回 `isFavorited`/`isPinned`、仓库列表 `ORDER BY is_pinned DESC`、行首角标、个人中心 `favorite` tab 接通。本次补齐写端 + UI + 级联清理，形成端到端闭环。

- **后端（4 接口 + 读端扩展 + 级联）**
  - `server/api/documents/[id]/favorite.post.ts` / `.delete.ts` — 任何员工可收藏（登录即可），幂等：已/未收藏直接返回 ok 不重写日志；仅真正落地变更时写 `favorite.add` / `favorite.remove`
  - `server/api/documents/[id]/pin.post.ts` / `.delete.ts` — 置顶权限走 `requireMemberPermission`（组内 role=1 管理员 / 组负责人 / super / company_admin / dept_head / pl_head 中匹配 scope 的）；未归组文档（`group_id=null`）→ 409 `DOCUMENT_STATUS_INVALID`；同样幂等，写 `pin.add` / `pin.remove`
  - `server/utils/group-permission.ts` 追加 `canUserPinInGroup(userId, groupId)` — 布尔版权限判定，读端回填 `canPin` 用（避免 fail 响应语义）
  - `server/api/documents/index.get.ts` / `[id]/index.get.ts` 响应追加 `canPin`，前端按钮可见性**由后端统一判定**，前端零重复逻辑
  - `server/api/recycle-bin/purge.post.ts` 事务内级联 `deleteMany doc_document_favorites / doc_document_pins`，防孤儿记录（这两张表无 `deleted_at` 列，硬删）
- **前端（API + 2 处 UI）**
  - `api/documents.ts` 补 4 个 API 函数
  - `types/document.ts` `DocumentDetail` / `DocumentListResponse` 追加 `canPin` 字段
  - `pages/docs/repo/[id].vue` 行 actions 下拉追加：
    - 收藏 / 取消收藏（所有成员，根据 `row.isFavorited` 切文案 + 命令字）
    - 置顶 / 取消置顶（`v-if="canPin"` 管理员可见）
    - `favPendingIds` / `pinPendingIds` Set 防连点（不需响应式）
    - 乐观更新 → API → 失败回滚 + 服务端 `isFavorited`/`isPinned` 对账
    - 置顶后 `refresh()` 重排（保持 `ORDER BY is_pinned DESC` 一致性）
  - `pages/docs/file/[id].vue` PageTitle 追加 2 个圆形图标按钮：
    - ⭐ 收藏（`StarFilled` / `Star` 切换，`warning` / `default` 色）
    - 📌 置顶（`v-if="detail.canPin"`，`primary` / `default` 色）
    - `favoritePending` / `pinPending` ref，`:loading` 态防抖
- **规格依据**：PRD §4.1（权限矩阵 — 管理员可置顶、可编辑可收藏）、§6.3.8 / §6.5（个人中心收藏 tab）、§1235-1237（引用文档置顶仅本组生效）
- **范围**：B 阶段 = 收藏/置顶写端闭环 + UI；**不涉及**文档引用的跨组置顶（依赖后续"文档引用"模块；schema UK `(document_id, group_id)` 已支持多组独立置顶）
- **文档同步**
  - `docs/api-auth-design.md` §3.60-3.63 新增 4 个接口详情、接口总览新增"收藏/置顶"段、定时任务表补 `approval:remind-timeout`
  - `docs/feature-gap-checklist.md` §2.5 仓库详情 / §2.7 文件详情 / §六 数据层对应条目打 ✅ 2026-04-24
  - `docs/superpowers/specs/2026-04-24-favorite-pin-design.md` / `docs/superpowers/plans/2026-04-24-favorite-pin.md` 新增

---

## 2026-04-27

### refactor: 共享文档结构性修复 — 去"仓库"化（PRD §6.3.1 / §6.3.2 / §6.3.4 严格对齐）

发现"组占位页 + 进入仓库按钮"违反 PRD §6.3.2 line 207「选中具体组后**直接显示**子组卡片 + 文件列表」。PRD 全文 0 次出现"仓库"；现行代码引入了 `pages/docs/repo/[id].vue` 独立路由 + 多处"仓库"措辞，是历史误译，本次结构性修复一并清除。

**核心改动**：

- **新建** `components/GroupFilesPanel.vue` —— 选中具体组的右栏完整视图：面包屑 + 组 header（名/描述/负责人/文件数/时间/组设置按钮）+ 操作条（创建子组/上传文件/导入飞书）+ 审批中提示条 + 子组卡片网格 + 关键词搜索 + 文件列表 DataTable（含锁图标 / 行 actions：详情/下载/收藏/置顶/文档级权限/移除）+ 分页 + UploadFileModal + DocPermissionModal 集成
- **简化** `components/DocExplorerPanel.vue` `type='group'` 分支 —— 去掉冗余"组占位页 + 进入仓库按钮"，直接挂 `<GroupFilesPanel>` 子组件
- **删除** `pages/docs/repo/[id].vue` —— PRD 无"仓库"概念，独立路由清除（按用户意见全清，不留 301 重定向）
- **URL 同步** `pages/docs/index.vue` —— `?groupId=X` query 同步：左树切换 → router.replace；URL 直链/刷新自动 selectGroupById；watch route.query.groupId 跨页跳回还原
- **后端字段**
  - `server/utils/group-permission.ts` 新增 `isUserGroupMember` / `canUserUploadInGroup` 两个布尔助手
  - `/api/documents` 列表响应顶层加 `canCreateSubgroup`（同 canPin 口径）+ `canUpload`（组内活跃成员 OR 上游管理员）
  - `types/document.ts` `DocumentListResponse` 同步新字段
- **文件详情页**
  - `pages/docs/file/[id].vue` "返回仓库" → 「返回 [组名]」（fallback "返回共享文档"）；`backToGroup` 跳 `/docs?groupId=X`；`handleRemove` 同步
- **全局术语清洗（仅代码层；历史 dev-progress 条目为时序快照保留）**
  - `utils/doc-meta.ts` / `types/document.ts` / `types/recycle-bin.ts` / `api/documents.ts` 注释
  - `pages/recycle-bin.vue` 列名/筛选标签/确认文案：原仓库 → 原组
  - `composables/useBreadcrumb.ts` 删除 `repo: '仓库详情'` 路径段
  - `pages/index.vue` 原型导航卡片去除 `/docs/repo/1` 条目；副标题改"组导航树 + 选中组直接展示子组卡片与文件列表"
  - `i18n/locales/zh-CN.ts` + `en-US.ts`：repoDetail* / repoCards / repoList / enterSampleRepo / colOriginalRepo / colRepo 全部改为对应"组"key 名 + 值
  - `server/api/documents/upload.post.ts` / `server/api/documents/index.get.ts` / `server/schemas/document.ts` / `server/schemas/recycle-bin.ts` 注释
  - `components/EmptyState.vue` `no-content` preset 描述
- **PRD 严格对照表**

| PRD 节 / 行 | 引用 | 落地点 |
|---|---|---|
| §6.3.1 line 195 | "右侧显示选中组的子组卡片和文件列表" | `GroupFilesPanel`（type='group'）|
| §6.3.2 line 207 | "选中具体组后**直接显示**" | 取消"组占位页 + 进入仓库按钮"中间步 |
| §6.3.2 line 206 | "鼠标悬停显示 + / ··· 飞书风格" | DocNavTreeNode 已实现，确认无需补 |
| §6.3.3 line 478 | 上传文件"组内所有成员（管理员/可编辑/上传下载）" | `canUpload` 后端字段 = `isUserGroupMember` OR `canUserPinInGroup` |
| §6.3.3 line 480 | 文档级权限+锁图标 列表行入口 | 行【···】菜单项 + title slot 锁图标（保留 B 阶段产物，搬到 `GroupFilesPanel`）|
| §6.3.4 line 510 | 文件详情"返回"按钮 | "返回 [组名]" + 跳 `/docs?groupId=X` |
| §4.3 权限矩阵 | 创建子组 / 置顶 / 配置权限 — 组管理员判定 | `canPin` = `canCreateSubgroup` = `canManagePermissions` 同口径 |

- **范围**：纯结构修复 + 术语清洗，不引入新业务功能；行【···】权限设置 / 锁图标等 B 阶段刚做的能力 100% 保留并搬到新位置
- **延迟项**（PRD 已涉及但本次未做）：飞书导入入口接通后端 / 文件列表批量操作 / 全局搜索栏

---

### feat: 文档级权限设置（PRD §6.3.4 + §6.3.3 line 480）

文件详情页 2.7 收口的第二项；伴随推动 §2.5 仓库行【···】"文档级权限"菜单项一起做完，避免 PRD 入口缺失。

**核心 — 权限 enum 4 值全栈对齐**

PRD 通篇"上传下载"是组级权限第三档；§4.2 / §4.3 / §253 / §254 / §276 / §367 / §539 / `doc_group_members.role` 注释完全一致（1管理员 / 2可编辑 / 3上传下载）。但 `doc_document_permissions` 当初按"分享 ACL"建表（1可编辑 / 2可阅读），与 PRD §6.3.4 文档级权限弹窗的"可编辑 / 上传下载"取值不匹配。§6.5.2 line 895-897 又把"组级或文档级权限设置"+"链接分享"两类来源合并到"分享给我的"——同一张表必须能容纳两套语义。

**方案**：`doc_document_permissions` / `doc_share_links` 的 `permission` enum 扩到 4 值，与 `doc_group_members.role` 同口径：

```
1 管理员    （仅组级用，本表不出现）
2 可编辑    （文档级 + 分享 共用）
3 上传下载  （仅文档级用）
4 可阅读    （仅分享用）
```

UI 渲染权限徽章共享一套 meta；业务规则按数值大小天然成立（PRD §6.3.7 "分享时可选权限不能超过分享人自身"= `shareLevel <= myLevel`）。

- **数据库**
  - `docs/patch-008-doc-permission-align-group-role.sql` 新建：ALTER 列注释 + 数据迁移（`UPDATE permission=4 WHERE 2; UPDATE permission=2 WHERE 1`）
  - 同步：`docs/doc.sql` 两张表列注释更新
  - 不需要：`docs/doc_seed.sql`（清理后已无该表数据）/ `docs/rbac.sql`（无新权限码）/ `prisma/schema.prisma`（TinyInt 通用）

- **常量层（全栈共享）**
  - `utils/permission-meta.ts` — 集中 `PERMISSION_LEVEL` 常量 + 各场景子集（`DOC_CUSTOM_PERMISSION_LEVELS` / `SHARE_PERMISSION_LEVELS` / `GROUP_MEMBER_ROLES`）+ `PERMISSION_LABEL` 中文标签 + `PERMISSION_META` 4 值徽章 meta（管理员红 / 可编辑蓝 / 上传下载琥珀 / 可阅读灰）
  - `server/constants/permission.ts` — 重导出 `~/utils/permission-meta`，避免双源
  - `server/constants/personal.ts` — 重导出 PERMISSION_LEVEL（兼容历史调用）
  - `utils/doc-meta.ts` — 旧 2 值 `PERMISSION_LEVEL_META` / `getPermissionLevelMeta` 改为重导出新 4 值版（向后兼容 profile.vue 调用面不破坏）
  - `types/personal.ts` — `PermissionLevel` 类型从 `1|2` 扩到 `1|2|3|4`

- **后端 API（GET / PUT 两端）**
  - `GET /api/documents/:id/permissions` — `{ groupMembers, customPerms }`，组成员只读区按"组负责人 → role 升序 → 加入时间"排序，文档级条目按 `created_at ASC`
  - `PUT /api/documents/:id/permissions` — 草稿模式整包替换；事务内 diff（INSERT / UPDATE / 软删）+ 一事件一日志；新增条目 `created_at=now`、UPDATE 改 `permission` + `updated_at`、软删写 `deleted_at`
  - 鉴权：`requireMemberPermission` 同置顶口径（PRD §6.3.4 "仅组管理员可配置"）
  - 业务规则：文档必须归组 + 目标必须是组成员 + 不允许给组负责人设置（覆盖最高权限无意义）
  - Zod schema `server/schemas/document-permission.ts`：`permission ∈ [2, 3]` + userId 唯一 + 上限 200
  - 错误码：`DOC_PERMISSION_NOT_IN_GROUP` / `DOC_PERMISSION_NOT_GROUP_MEMBER` / `DOC_PERMISSION_TARGET_INVALID`

- **后端读端字段扩展**
  - `/api/documents/:id` + `/api/documents` 列表响应同步加：
    - `hasCustomPermissions: boolean`（行级，EXISTS 子查询，PRD §6.3.3 / §6.3.4 锁图标用）
    - `canManagePermissions: boolean`（顶层 / 详情，与 `canPin` 同口径，组管理员判定 — 复用 `canUserPinInGroup`）

- **操作日志**
  - 沿用既有 `permission.doc_update` action（与 `permission.group_update` 单 action 口径一致），按 diff 写多条
  - 4 种 desc 文案区分：
    - 新增：`为「张三」设置文档级权限「可编辑」`
    - 升级：`将「王五」的文档级权限从「上传下载」升级为「可编辑」`
    - 降级：`将「赵六」的文档级权限从「可编辑」降级为「上传下载」`
    - 移除：`移除「李四」的文档级权限`

- **前端组件**
  - `components/GroupMemberPickerModal.vue` 新建 — 仅组成员选择（搜索 + 多选 + 已自定义 / 组负责人灰显）；按 PRD line 6024 原型"仅限组成员"实现，**不复用** MemberSelectorModal（后者是飞书全公司目录钻入，语义不符）
  - `components/DocPermissionModal.vue` 新建 — PRD §6.3.4 弹窗主体：组权限只读区 + 文档级权限区（行内权限下拉 + 删除按钮）+ 添加成员区（输入框 readonly 点击打开 picker + 默认权限下拉 + 添加按钮）+ 草稿模式 + 关闭前 dirty 二次确认
  - `api/document-permissions.ts` + `types/document-permission.ts`

- **页面接入（2 个入口，PRD 双入口完整呈现）**
  - `pages/docs/file/[id].vue` — 操作栏新增「权限设置」按钮（v-if `canManagePermissions`）+ 文件信息卡文件名旁加橙锁图标（v-if `hasCustomPermissions`，悬停 tooltip）
  - `pages/docs/repo/[id].vue` — 行【···】下拉新增「文档级权限」菜单项（v-if `canManagePermissions`）+ 文件名旁锁图标 + 集成同弹窗
  - 两端弹窗保存后 `loadDetail()` / `refresh()`，由后端 EXISTS 子查询自动对账锁图标

- **样式**
  - `assets/styles/components/_doc-preview.scss` — `.df-file-info-name` 改 flex 布局（容纳锁图标）+ `.df-file-info-lock` 新加

- **PRD 严格对照（防止"功能模糊"）**
  - 弹窗结构 / 按钮 / 草稿模式：§6.3.4 line 483
  - 双入口（详情页操作栏 + 列表行【···】）：§6.3.3 line 480 + §6.3.4
  - 双锁图标（详情页 + 列表行）：§6.3.3 line 480 + §6.3.4
  - "仅限组成员"选择器范围：原型 HTML line 6024
  - "覆盖组级权限"语义：§6.3.4 + §6.5.2 line 895-897 合并语义到"分享给我的"
  - "权限标签 vs 下拉"PRD 用"标签"原型 HTML 用 `<select>`：遵循原型（行内可改更优）

- **范围**：A 阶段 = 弹窗读 / 写 + 锁图标 + 双入口接入；**不做**：M14-M16 通知（归 permission-request 模块，用户主动申请→归属人审批语义，本次"管理员主动设置"不沾）/ M19（归 group-member 模块，组级 role 变更语义不沾）

- **数据库 / 文档同步**：`docs/api-auth-design.md` §3.65 / §3.66 + 接口总览新增"文档级权限"段；`docs/feature-gap-checklist.md` §2.5 行【···】文档级权限 ✅ + §2.7 权限设置弹窗 ✅

---

### feat: 文件详情底部「审批记录」TAB（PRD §6.3.4）

文件详情页 2.7 收口的第一项。剩余 5 项（权限设置 / 跨组移动 / 上传新版本 UX / 全屏预览 / 文件级操作菜单）按顺序后续推进；评论 / 飞书评论 / 标注归"评论 + 标注"大核心阶段，本次不做。

- **后端**
  - 新增 `GET /api/documents/:id/approvals` — 单文档审批历史（不分页，按 `inst.created_at DESC` 全量返回）
  - 字段集与 `/api/approvals` 列表项一致（`ApprovalItem`），区别：`canWithdraw` 恒为 `false`、`currentApproverName` 仅在 `status=2` 时返回、`handledAt` 取 `inst.finished_at`
  - 鉴权：`doc:read` + 文档存在性校验（与文件详情页 `GET /api/documents/:id` 一致）
  - SQL 复用 `/api/approvals` 的子查询模式（current_approver / all_approvers / remind_count / reject_reason / is_first_version）
- **前端**
  - `api/documents.ts` 新增 `apiGetDocumentApprovals`
  - `pages/docs/file/[id].vue` 底部追加 `TabBar`（PRD §6.3.4 三 TAB 容器，本次只挂"审批记录"，预留"评论 / 飞书评论"位置）
  - 复用 `ApprovalListCard`（传 `tab="submitted"` 让卡片以"审批人列表"展示）+ `ApprovalDrawer`（只读模式：`status=2` 强制映射为 `'approved'` 抽屉态以隐藏通过/驳回区，chain 节点状态独立按真实 `actionStatus` 渲染）
  - `loadApprovalRecords` 在 `onMounted` 与"提交审批成功"后并发刷新；`watch(bottomTab)` 兜底懒加载（待评论 tab 接入后切回审批记录时复用）
  - 空态：`EmptyState` 复用 `no-completed` 图，自定义文案「该文档还未发起任何审批」
- **样式**
  - `assets/styles/components/_doc-preview.scss` 追加 `.df-file-tabs` / `.df-file-tabs__panel` / `.df-file-tabs__loading` / `.df-file-tabs__list` 容器样式
- **规格依据**：PRD §6.3.4「底部 TAB 区 — 评论 / 飞书评论 / 审批记录」 + §6.4.2 列表项字段
- **范围**：单文档审批历史读端 + 抽屉只读查看；**不做**通过/驳回/撤回（撤回入口在审批中心，通过/驳回入口在审批中心 pending tab）
- **数据库改动**：无（`doc_approval_instances` / `doc_approval_instance_nodes` / `doc_approval_templates` 已有，无需新表新字段）
- **文档同步**：`docs/api-auth-design.md` §3.64 + 接口总览审批中心段；`docs/feature-gap-checklist.md` §2.7 打 ✅

---

## 待开发（按优先级排序）

| 优先级 | 模块 | 状态 |
|--------|------|------|
| P0 | 文档管理核心 — 上传/元数据/版本/状态流转 | ✅ A 阶段完成于 2026-04-24（见提交 `81229ca`） |
| P1 | 组成员管理 B 阶段 — 继承机制 / 负责人移交 | 🕓 待产品讨论 |
| P1 | 审批流运行时 — 实例起审批 / 通过驳回 / 超时催办 | ✅ A+B 阶段完成于 2026-04-24（起审批/通过/驳回/撤回 + M1-M7 通知 + cron 催办）|
| P1 | 站内通知 — 三类通知 + 已读未读 | ✅ A 阶段完成于 2026-04-18（触发点接入随各业务补；M1-M9 已接入 2026-04-24） |
| P2 | 操作日志 | ✅ A 阶段完成于 2026-04-17（埋点随各业务补） |
| P2 | 回收站 | ✅ A 阶段完成于 2026-04-18（30 天自动清理 cron 后续排期） |
| P2 | 收藏 / 置顶 | ✅ B 阶段完成于 2026-04-24（读端 A 阶段 + 写端 B 阶段 + UI + 级联清理）|
| P2 | 评论 / 批注、文档引用、搜索、分享 | ⏳ 待排期 |
| P3 | M24 审批链成员因离职/调岗移除 | 🕓 待产品讨论（归"离职交接运行时"整体设计）|
