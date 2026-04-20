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

## 待开发（按优先级排序）

| 优先级 | 模块 | 状态 |
|--------|------|------|
| P0 | 文档管理核心 — 上传/元数据/版本/状态流转 | ⏳ 待排期 |
| P1 | 组成员管理 B 阶段 — 继承机制 / 负责人移交 | 🕓 待产品讨论 |
| P1 | 审批流运行时 — 实例起审批 / 通过驳回 / 超时催办 | ⏳ 待排期（模板配置 2026-04-17 完成；审批中心 A 阶段列表 + 撤回 2026-04-18 完成） |
| P1 | 站内通知 — 三类通知 + 已读未读 | ✅ A 阶段完成于 2026-04-18（触发点接入随各业务补） |
| P2 | 操作日志 | ✅ A 阶段完成于 2026-04-17（埋点随各业务补） |
| P2 | 回收站 | ✅ A 阶段完成于 2026-04-18（30 天自动清理 cron 后续排期） |
| P2 | 评论/批注、收藏/置顶、文档引用、搜索、分享 | ⏳ 待排期 |
