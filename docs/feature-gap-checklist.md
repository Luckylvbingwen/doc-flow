# DocFlow 功能差距清单

> 基于 `prototype-v21.0.html` 原型与 `企业文档管理系统-产品需求说明文档.md` 综合分析，记录当前待补充的功能项。  
> 已完成的功能会从对应分类中移除。  
> 最后更新：2026-04-17

---

## 一、公共组件

| 组件 | 用途 | 使用页面 |
|------|------|----------|
| EmptyState | ~~统一空态（图标+文字+可选操作按钮）~~ ✅ 已完成 | ~~几乎所有列表页~~ |
| BulkActionBar | ~~批量操作浮动药丸栏（已选N项+操作按钮组）~~ ✅ 已完成 | ~~docs、recycle-bin~~ |
| FileMetaHeader | ~~文件头信息条（图标+名称+徽章+属性行+操作区）~~ ✅ 已完成 | ~~file/[id]、approvals~~ |
| ApprovalDrawer | ~~审批详情抽屉（文件卡+审批链+意见区+操作按钮）~~ ✅ 已完成 | ~~approvals、file/[id]~~ |
| ApprovalChain | ~~审批流程节点可视化（发起→审批人→…→完成）~~ ✅ 已完成 | ~~approvals、file/[id]~~ |
| CommentThread | ~~评论线程（头像+内容+时间+回复）~~ ✅ 已完成 | ~~file/[id]~~ |
| ActivityFilterBar | 日志筛选条（搜索+时间范围+操作类型 chips） | logs |
| RemoteSelect | ~~远程搜索 + 滚动分页下拉~~ ✅ 2026-04-18 | 回收站原仓库筛选、未来成员选择 |
| MemberPicker | ~~成员选择器（飞书风格 / 部门钻入 / 已选面板）~~ ✅ 已完成 `MemberSelectorModal` | ~~组设置、admin~~ |
| PermissionEditor | 权限编辑弹窗（继承/自定义+角色矩阵） | repo 设置、file/[id] |
| MoveTargetPicker | 跨组移动目标选择器（复用 DocNavTree） | file/[id]、docs |
| StatsCard | 统计数字卡片（数字+标签+趋势图标） | admin、docs 首页 |

## 二、页面交互补全

### 2.1 审批管理 (`pages/approvals.vue`)

- [x] ~~三 Tab 列表（待我审批 / 我发起的 / 我已处理）~~ ✅ 2026-04-18
- [x] ~~状态筛选 + 分页 + 空态~~ ✅ 2026-04-18
- [x] ~~变更类型徽章（新增/迭代）~~ ✅ 2026-04-18（SQL 按 version 位置判定）
- [x] ~~撤回操作~~ ✅ 2026-04-18（仅发起人 + reviewing 状态）
- [x] ~~超时催办状态~~ ✅ 2026-04-18（remind_count > 0 红底徽章展示）
- [ ] 审批抽屉（ApprovalDrawer 集成） — B 阶段"审批流运行时"
- [ ] 审批链可视化（ApprovalChain 集成） — B 阶段
- [ ] 驳回必填校验（驳回时意见为必填项） — B 阶段
- [ ] 变更摘要展示（文件版本变更内容概要） — B 阶段
- [ ] 催办触发逻辑（定时任务扫描超时节点） — B 阶段

### 2.2 操作日志 (`pages/logs.vue`)

- [x] ~~搜索框（关键词搜索）~~ ✅ 2026-04-17
- [x] ~~时间范围选择器~~ ✅ 2026-04-17（按天 daterange）
- [x] ~~操作类型筛选（14 大类下拉）~~ ✅ 2026-04-17
- [x] ~~分页功能~~ ✅ 2026-04-17（服务端分页）
- [x] ~~空态展示~~ ✅ 2026-04-17（EmptyState `no-logs` preset）
- [x] ~~日志描述格式化~~ ✅ 2026-04-17（取 `detail_json.desc`，无则兜底）
- [ ] 埋点落地 — 各业务模块按纪律 INSERT `doc_operation_logs`（随对应功能开发补齐）

### 2.3 通知中心 (`pages/notifications.vue`)

- [x] ~~分类 tab（审批通知 / 系统通知 / 成员变更）~~ ✅ 2026-04-18
- [x] ~~未读计数 badge~~ ✅ 2026-04-18
- [x] ~~全部标为已读~~ ✅ 2026-04-18
- [x] ~~已读/未读视觉状态区分~~ ✅ 2026-04-18

### 2.4 回收站 (`pages/recycle-bin.vue`)

- [x] ~~批量选择~~ ✅ 2026-04-18（DataTable showSelection + BulkActionBar）
- [x] ~~恢复确认弹窗~~ ✅ 2026-04-18（msgConfirm，原组已删走失败列表）
- [x] ~~永久删除确认弹窗~~ ✅ 2026-04-18（msgConfirm type=error + danger 按钮）
- [x] ~~来源组信息展示~~ ✅ 2026-04-18（含删除人列，PRD 外 +1）
- [x] ~~关键词 / 原仓库筛选~~ ✅ 2026-04-18（原仓库用 RemoteSelect 远程分页；删除时间范围按 PRD 未做）
- [x] ~~按角色自动过滤数据范围~~ ✅ 2026-04-18（super/company 全站；dept/pl 范围内；其他仅自己+所在组）
- [ ] **查看按钮（PRD §6.6.2 "仅展示改版正文"）** — 延迟至文件上传/预览模块完成后接入（当前正文依赖未就绪）
- [ ] 30 天过期自动清理（cron 任务，后续排期）

### 2.5 仓库详情 (`pages/docs/repo/[id].vue`)

- [ ] 文件列表工具栏（排序+视图切换+搜索）
- [ ] 批量操作（勾选+批量删除/移动/下载）
- [x] ~~组设置 — 基础设置 tab~~ ✅ 2026-04-17（`GroupSettingsModal` 基本设置 Tab）
- [x] ~~组设置 — 成员管理 tab~~ ✅ 2026-04-17（`GroupSettingsModal` 成员管理 Tab）
- [x] ~~组设置 — 审批流配置 tab~~ ✅ 2026-04-17（`GroupApprovalPanel`，整包 PUT + 组创建时初始化默认模板）
- [ ] 飞书导入入口

### 2.6 文档主页 (`pages/docs/index.vue`)

- [ ] 右侧面板按节点类型展示（分类概览/部门/产品线/组详情） ← 开发中
- [ ] 树接通真实 API 数据（替换 mock） ← 开发中
- [ ] 创建组弹窗 ← 开发中
- [ ] 创建产品线弹窗 ← 开发中
- [ ] 树节点操作菜单（编辑/删除/创建子组） ← 开发中
- [ ] 右侧文件区（文件列表+网格视图）
- [ ] 全局搜索栏

### 2.7 文件详情 (`pages/docs/file/[id].vue`)

- [ ] 评论区（CommentThread 集成）
- [ ] 审批记录标签页
- [ ] 权限设置弹窗（PermissionEditor 集成）
- [ ] 跨组移动弹窗（MoveTargetPicker 集成）
- [ ] 上传新版本完整流程
- [ ] 全屏文件预览器
- [ ] 文件级操作菜单（下载/分享/删除等）

### 2.8 管理后台 (`pages/admin.vue`)

- [ ] 部门详情面板
- [ ] 产品线详情面板
- [ ] 项目组详情面板
- [ ] 负责人交接流程
- [ ] 停用用户流程
- [ ] 全局配置页

## 三、Composable / 工具函数

| 名称 | 用途 |
|------|------|
| useConfirmAction | 统一的「确认→执行→反馈」封装（删除/恢复/回滚等危险操作） |
| useBatchSelect | 表格批量选中状态管理（全选/反选/已选计数） |
| useNotificationBadge | 通知未读数管理（WebSocket 推送+本地缓存） |
| formatActivity | 日志描述格式化工具函数 |

## 四、第三方库

| 库 | 用途 | 优先级 |
|----|------|--------|
| sortablejs / @types/sortablejs | 审批链节点拖拽排序、成员排序 | 高 |
| pdfjs-dist | PDF 全屏预览（页级导航） | 中 |
| @tiptap/vue-3 系列 | 在线富文本编辑（需求确认后再装） | 低 |

## 五、样式层

- [ ] 审批链节点样式
- [ ] 状态徽标统一样式体系
- [ ] 操作类型 chips 样式
- [ ] 仓库卡片样式
- [ ] 文件头信息区样式
- [ ] 评论线程样式
- [ ] 全屏查看器工具栏样式

## 六、数据层

- [ ] 版本列表 API 接真实数据库
- [ ] 版本对比 API 接真实文件存储
- [ ] 回滚 API 与事务
- [ ] 上传新版本 API
- [ ] 审批流 CRUD API
- [ ] 文档 CRUD API
- [x] ~~通知 API~~ ✅ 2026-04-18（4 接口已完成，见「七、通知触发点接入清单」）
- [ ] 日志查询 API

---

## 七、通知触发点接入清单

> M1-M24 各消息归属模块和触发点。开发对应业务模块时对照此表接入
> `NOTIFICATION_TEMPLATES.Mx.build(...)`，接入后打 ✅ 并写完成日期。
> 权威源：`server/constants/notification-templates.ts`

| 消息 | 归属模块 | 触发点 | 状态 |
|---|---|---|---|
| M1 | approval-runtime | 文件提交审批 — 通知当前审批人 | ⏳ 待接入 |
| M2 | approval-runtime | 审批流转下一级 — 通知下一级 | ⏳ 待接入 |
| M3 | approval-runtime | 最后一级通过 — 通知提交人 | ⏳ 待接入 |
| M4 | approval-runtime | 任一级驳回 — 通知提交人 | ⏳ 待接入 |
| M5 | approval-runtime | 超时 24h 催办 — 通知该步审批人 | ⏳ 待接入 |
| M6 | approval-runtime | 催办达上限 — 通知提交人 | ⏳ 待接入 |
| M7 | approval-runtime | 提交人撤回 — 通知已参与审批人 | ⏳ 待接入 |
| M8 | document-lifecycle | 新版本发布 — 通知归属人+编辑成员+管理员 | ⏳ 待接入 |
| M9 | document-lifecycle | 管理员从组移除文件 — 通知归属人 | ⏳ 待接入 |
| M10 | ownership-transfer | 发起归属人转移 — 通知新归属人 | ⏳ 待接入 |
| M11 | ownership-transfer | 转移同意/拒绝/过期 — 通知发起人 | ⏳ 待接入 |
| M12 | cross-move | 发起跨组移动 — 通知目标组负责人 | ⏳ 待接入 |
| M13 | cross-move | 移动同意/拒绝/过期 — 通知发起人 | ⏳ 待接入 |
| M14 | permission-request | 阅读权限申请 — 通知归属人 | ⏳ 待接入 |
| M15 | permission-request | 编辑权限申请 — 通知归属人 | ⏳ 待接入 |
| M16 | permission-request | 权限审批结果 — 通知申请人 | ⏳ 待接入 |
| M17 | share | 分享文档 — 通知被分享人 | ⏳ 待接入 |
| M18 | group-member | 被加入组 — 通知被添加成员 | ⏳ 待接入（组成员管理已有 API，B 阶段可一并补） |
| M19 | group-member | 成员权限变更 — 通知被变更成员 | ⏳ 待接入（同上） |
| M20 | group-member | 被移出组 — 通知被移出成员 | ⏳ 待接入（同上） |
| M21 | role-assign | 管理员角色指派/撤销 | ⏳ 待接入 |
| M22 | group-owner | 组负责人变更 | ⏳ 待接入 |
| M23 | hr-handover | 员工离职交接 | ⏳ 待接入 |
| M24 | approval-chain-change | 审批链成员因离职/调岗移除 | ⏳ 待接入 |

**开发流程：** 做某业务模块前 → `grep "triggerModule: 'xxx'" server/constants/notification-templates.ts` 反查 M 码 → 依模板接入 → 本表打 ✅ + 日期。

**延迟项**：
- `/docs/repo/[id].vue` 页的 `?openSettings=approval` query 自动打开组设置审批配置 Tab，因 repo 页当前未集成 GroupSettingsModal，推迟到 repo 页整合时一并实现。通知中心 M24 卡片点击会跳到 `/docs/repo/:id?openSettings=approval`，目前只跳转不自动开弹窗。

---

## 已完成功能

> 从上方清单移除的功能记录在此，便于追溯。

### 公共组件

| 组件 | 完成日期 |
|------|----------|
| DataTable | 已有 |
| Modal | 已有 |
| DetailDrawer | 已有 |
| DocNavTree / DocNavTreeNode | 已有 |
| DocPreview | 2026-03-31 |
| VersionSidebar | 2026-03-31 |
| VersionCompareViewer | 2026-03-31 |
| FileUploader / UploadModal | 已有 |
| PageTitle | 已有 |
| Pagination | 已有 |
| TabBar | 已有 |
| CaptchaDialog | 已有 |
| EmptyState（缺省页，含 11 种 preset + unDraw 插画） | 2026-03-31 |
| ApprovalChain（审批链可视化，支持 4 种状态 + 紧凑/垂直模式） | 2026-03-31 |
| CommentThread（评论线程，支持嵌套回复/删除确认/Ctrl+Enter/动画） | 2026-03-31 |
| ApprovalDrawer（审批抽屉，含文档信息/变更摘要/审批链/意见校验） | 2026-03-31 |
| MemberSelectorModal（飞书风格成员选择器 / 部门钻入 / 已选面板 / PRD §254 权限下拉） | 2026-04-17 |
| GroupMemberPanel（成员列表 / 行级权限下拉 / 移除 / 组负责人锁定） | 2026-04-17 |
| GroupSettingsModal（组设置弹窗，三 Tab：审批流占位 / 成员管理 / 基本设置） | 2026-04-17 |
| GroupApprovalPanel（审批流配置面板：开关 / 模式 / 审批人 / 链路预览） | 2026-04-17 |
| NotificationBell（顶栏铃铛 + 红角标 99+ + Popover 触发） | 2026-04-18 |
| NotificationPopover（下拉面板 380×480，未读/全部切换 + 底部全部已读/查看全部） | 2026-04-18 |
| NotificationCard（单条卡片，未读态底色 + 点击跳转） | 2026-04-18 |

### 工具 / 后端

| 项目 | 完成日期 |
|------|----------|
| diff 引擎 (`server/utils/diff.ts`) | 2026-03-31 |
| 文件格式提取 (`server/utils/extract.ts`) — docx/pdf/xlsx | 2026-03-31 |
| 版本列表 API (Mock) | 2026-03-31 |
| 版本对比 API (Mock) | 2026-03-31 |
| types/version.ts 类型定义 | 2026-03-31 |
| server/schemas/version.ts Zod 校验 | 2026-03-31 |
| 登录 / 飞书 OAuth / RBAC 全链路 | 已有 |
| 数据库全量重建（对齐 PRD v2.1，34 表） | 2026-04-16 |
| Prisma schema 同步（34 模型） | 2026-04-16 |
| 组成员管理 A 阶段（5 接口：成员 CRUD + 部门用户树 + 权限扩展） | 2026-04-17 |
| 组审批模板 A 阶段（2 接口 + 组创建初始化） | 2026-04-17 |
| 操作日志 A 阶段（14 类聚合 / `GET /api/logs` / 筛选分页 / 埋点纪律） | 2026-04-17 |
| 通知中心 A 阶段（4 接口 / createNotification helper / NOTIFICATION_TEMPLATES M1-M24 模板表 / WS badge 对账） | 2026-04-18 |

### 第三方库

| 库 | 完成日期 |
|----|----------|
| diff | 2026-03-31 |
| mammoth | 2026-03-31 |
| pdf-parse | 2026-03-31 |
| xlsx | 2026-03-31 |
| markdown-it | 2026-03-31 |
