# DocFlow 功能差距清单

> 基于 `prototype-v21.0.html` 原型与 `企业文档管理系统-产品需求说明文档.md` 综合分析，记录当前待补充的功能项。  
> 已完成的功能会从对应分类中移除。  
> 最后更新：2026-05-18

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
| ~~ActivityFilterBar~~ | ~~日志筛选条（搜索+时间范围+操作类型 chips）~~ ✅ 2026-05-13 | ~~logs~~ |
| RemoteSelect | ~~远程搜索 + 滚动分页下拉~~ ✅ 2026-04-18 | 回收站原仓库筛选、未来成员选择 |
| MemberPicker | ~~成员选择器（飞书风格 / 部门钻入 / 已选面板）~~ ✅ 已完成 `MemberSelectorModal` | ~~组设置、admin~~ |
| ~~PermissionEditor~~ | ~~权限编辑弹窗（继承/自定义+角色矩阵）~~ ✅ 2026-04-27（`DocPermissionModal` 实现） | ~~file/[id]~~ |
| ~~MoveTargetPicker~~ | ~~跨组移动目标选择器（复用 DocNavTree）~~ ✅ 2026-04-28（`MoveTargetPicker` 实现） | ~~file/[id]、docs~~ |
| ~~StatsCard~~ | ~~统计数字卡片（数字+标签+趋势图标）~~ ✅ 2026-05-13 | ~~admin、docs 首页~~ |

## 二、页面交互补全

### 2.1 审批管理 (`pages/approvals.vue`)

- [x] ~~三 Tab 列表（待我审批 / 我发起的 / 我已处理）~~ ✅ 2026-04-18
- [x] ~~状态筛选 + 分页 + 空态~~ ✅ 2026-04-18
- [x] ~~变更类型徽章（新增/迭代）~~ ✅ 2026-04-18（SQL 按 version 位置判定）
- [x] ~~撤回操作~~ ✅ 2026-04-18（仅发起人 + reviewing 状态）
- [x] ~~超时催办状态~~ ✅ 2026-04-18（remind_count > 0 红底徽章展示）
- [x] ~~审批抽屉（ApprovalDrawer 集成）~~ ✅ 2026-04-24（文档核心 A 阶段一并落地）
- [x] ~~审批链可视化（ApprovalChain 集成）~~ ✅ 2026-04-24（抽屉内渲染）
- [x] ~~驳回必填校验（驳回时意见为必填项）~~ ✅ 2026-04-24（Zod min(1) + 抽屉红字提示）
- [x] ~~变更摘要展示（文件版本变更内容概要）~~ ✅ 2026-04-24（抽屉调 `/api/version/compare`）
- [x] ~~变更摘要 5 条截断 + 展开/收起~~ ✅ 2026-05-14（PRD 要求「默认展示5项」）
- [x] ~~全屏对比跳转~~ ✅ 2026-05-14（审批抽屉 @compare → 文件详情页 ?compare=1）
- [x] ~~会签模式运行时~~ ✅ 2026-05-14（后端 approve/reject 支持 mode=2，前端 ApprovalChain 并列展示）
- [x] ~~催办触发逻辑（定时任务扫描超时节点）~~ ✅ 2026-04-24（`approval:remind-timeout` cron 每整点扫，M5/M6 触发）

### 2.2 操作日志 (`pages/logs.vue`)

- [x] ~~搜索框（关键词搜索）~~ ✅ 2026-04-17
- [x] ~~时间范围选择器~~ ✅ 2026-04-17（按天 daterange）
- [x] ~~操作类型筛选（14 大类下拉）~~ ✅ 2026-04-17
- [x] ~~分页功能~~ ✅ 2026-04-17（服务端分页）
- [x] ~~空态展示~~ ✅ 2026-04-17（EmptyState `no-logs` preset）
- [x] ~~日志描述格式化~~ ✅ 2026-04-17（取 `detail_json.desc`，无则兜底）
- [x] ~~埋点落地 — 各业务模块按纪律 INSERT `doc_operation_logs`~~ ✅ 2026-04-28（组 CRUD 3 接口 + 成员增删改 3 接口 + 产品线 CRUD 3 接口，共 9 处补齐；此前已有 23+ 处埋点覆盖文件上传/下载/审批/发布/移动/移除/回收站/权限/分享/收藏置顶/评论/角色指派）

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
- [x] ~~查看按钮（PRD §6.6.2 “仅展示改版正文”）~~ ✅ 2026-04-28（回收站专用预览接口 `GET /api/recycle-bin/:id/preview` + 弹窗 DocPreview 集成）
- [x] ~~30 天过期自动清理~~ ✅ 2026-04-28（cron `recycle:auto-purge` 每天 3:00，分批 200 永久删除 + 级联清理收藏/置顶 + 操作日志）

### 2.5 共享文档（`pages/docs/index.vue` + `DocExplorerPanel` + `GroupFilesPanel`）

> PRD §6.3 共享文档全部归在此节。无独立"仓库详情"页面 ——
> 选中具体组节点后，右侧面板**直接**展示子组卡片 + 文件列表（PRD §6.3.2 line 207）。

**树侧（`DocNavTree` / `DocNavTreeNode`）**

- [x] ~~三层分类（公司层 / 按部门 / 按产品线）+ 无限嵌套~~ ✅ 已有
- [x] ~~树节点 hover「+」「···」图标（PRD §6.3.2 line 206 飞书风格）~~ ✅ 已有
- [x] ~~树接通真实 API 数据~~ ✅ 2026-04-16
- [x] ~~创建组弹窗 / 创建产品线弹窗~~ ✅ 2026-04-16
- [x] ~~树节点操作菜单（编辑/删除/创建子组）~~ ✅ 已有 `TreeActionMenu`
- [x] ~~全局搜索栏~~ ✅ 2026-04-28（DocNavTree 已内置搜索，tree API 返回 files 后即可按文件名匹配）

**右栏分类视图（`DocExplorerPanel` type=category/department/productline）**

- [x] ~~分类概览（公司层 / 部门 / 产品线）+ 创建按钮 + 下级卡片~~ ✅ 2026-04-16
- [x] ~~产品线管理按钮 / 部门管理占位 / 公司层管理员设置占位~~ ✅ 2026-04-20
- [x] ~~产品线管理完整面板（3Tab：基本信息/管理员/项目组）~~ ✅ 2026-04-29
- [x] ~~公司层管理员设置面板（查看/添加/移除公司层管理员）~~ ✅ 2026-04-29

**右栏组视图（`GroupFilesPanel`）— PRD §6.3.2 line 207 / §6.3.3**

- [x] ~~选中具体组直接展示：子组卡片 + 文件列表~~ ✅ 2026-04-27
- [x] ~~URL ?groupId=X 同步（直链 / 刷新还原 / 跨页跳回）~~ ✅ 2026-04-27
- [x] ~~组 header（组名 / 描述 / 负责人 / 文件数 / 创建时间 / 组设置按钮）~~ ✅ 2026-04-27
- [x] ~~操作条（创建子组 / 上传文件 / 导入飞书 — 按 canCreateSubgroup / canUpload）~~ ✅ 2026-04-27
- [x] ~~审批中提示条（reviewingCount > 0 时）~~ ✅ 2026-04-27
- [x] ~~关键词搜索 + 分页 + 行 actions（详情/下载/收藏/置顶/文档级权限/移除）~~ ✅ 2026-04-27
- [x] ~~行级 title slot：置顶/收藏/锁图标~~ ✅ 2026-04-27
- [x] ~~组设置 — 基础设置 tab~~ ✅ 2026-04-17（`GroupSettingsModal` 基本设置 Tab）
- [x] ~~组设置 — 成员管理 tab~~ ✅ 2026-04-17（`GroupSettingsModal` 成员管理 Tab）
- [x] ~~组设置 — 审批流配置 tab~~ ✅ 2026-04-17（`GroupApprovalPanel`，整包 PUT + 组创建时初始化默认模板）
- [x] ~~文件列表批量操作（勾选 + 批量删除/移动/下载）~~ ✅ 2026-04-28（DataTable showSelection + BulkActionBar + batch-remove API + 批量下载）
- [x] ~~飞书导入入口接通后端~~ ✅ 2026-05-13（POST /api/groups/:id/feishu-import，调飞书 raw_content API 转 MD，走 executeUpload 审批路由；FeishuImportModal 弹窗）

### 2.7 文件详情 (`pages/docs/file/[id].vue`)

- [x] ~~评论区（CommentThread 集成）~~ ✅ 2026-04-28（GET/POST/DELETE /api/documents/:id/comments + CommentThread 底部 Tab 集成 + 嵌套回复 + 软删除）
- [x] ~~审批记录标签页~~ ✅ 2026-04-27（底部 TabBar + 审批记录列表 + ApprovalDrawer 只读模式 + `GET /api/documents/:id/approvals`）
- [x] ~~权限设置弹窗（PermissionEditor 集成）~~ ✅ 2026-04-27（DocPermissionModal + GroupMemberPickerModal + GET/PUT /api/documents/:id/permissions + 4 值权限 enum 全栈对齐 + 文件信息卡橙锁图标）
- [x] ~~跨组移动弹窗（MoveTargetPicker 集成）~~ ✅ 2026-04-28（MoveTargetPicker + POST /api/documents/:id/move + PUT /api/documents/cross-move/:id/review + M12/M13 通知）
- [x] ~~上传新版本完整流程~~ ✅ 2026-04-28（POST /api/documents/:id/versions + UploadFileModal update 模式 + VersionSidebar 按钮 + 审批路径判定 + 通知日志，全链路已实现）
- [x] ~~全屏文件预览器~~ ✅ 2026-04-27（`FullscreenPreviewer` Teleport 全屏壳 + 顶栏标题/类型/版本徽章 + 左侧目录面板（H1-H3 自动抽取 + IntersectionObserver 高亮 + 可折叠）+ 主体 DocPreview 包裹（渲染字号 / 行距加大）+ 右侧批注面板占位 + ESC 关闭 + body scroll lock；附带修 DocPreview MD/TXT 分支，新增 `html` prop 优先使用服务端预渲染 HTML，原 `content` 客户端 markdown-it 路径作 fallback）
- [x] ~~收藏 / 置顶图标按钮（PageTitle 圆形按钮，状态切换 + 乐观更新）~~ ✅ 2026-04-24
- [x] ~~下载按钮~~ ✅ 2026-04-28（文件详情页操作栏新增下载当前版本按钮）
- [x] ~~文件级操作菜单（分享/删除等）~~ ✅ 2026-04-28（分享按钮 + ShareLinkModal + 跨组移动按钮 + 从组移除按钮，均已集成到操作栏）
- [x] ~~顶部操作栏重构（核心按钮 + 更多菜单）~~ ✅ 2026-04-28（编辑器风格 topbar：返回+图标+文件名+状态+版本号+协作者头像+核心按钮+···下拉菜单，底部元信息条）
- [x] ~~版本回滚富确认弹窗（RollbackConfirmModal）~~ ✅ 2026-04-28（警示色头部 + 版本方向信息卡 + el-alert 提示，替代简单 msgConfirm）
- [x] ~~协作者头像栈（AvatarStack）~~ ✅ 2026-04-28（名字哈希色 + 最多 3 个 + 溢出 "+N" 指示器）
- [x] ~~文档操作历史抽屉（HistoryDrawer + API）~~ ✅ 2026-04-28（`GET /api/documents/:id/history` + 时间线 UI + 分页）
- [x] ~~编辑按钮占位~~ ✅ 2026-04-28（topbar 核心按钮区，handler 占位待编辑器集成）

### 2.8 系统管理 (`pages/admin.vue`) — 对齐 PRD §6.9

- [x] ~~用户列表（多角色聚合 + 管理范围 + 状态 + 筛选 + 分页）~~ ✅ 2026-04-20
- [x] ~~角色管理弹窗（公司层管理员 / 产品线负责人 双卡片 + 产品线只读 tag）~~ ✅ 2026-04-20
- [x] ~~飞书全员预落地到 doc_users + 部门主管自动 dept_head（§327）~~ ✅ 2026-04-20
- [x] ~~产品线 POST/PUT 事务自动授予 owner 的 pl_head 角色（数据一致性）~~ ✅ 2026-04-20
- [x] ~~停用用户流程~~ ✅ 2026-05-13（PUT /api/admin/users/:id/deactivate，清理组成员、交接负责组、移除审批链，触发 M22/M23/M24）
- [x] ~~负责人交接流程~~ ✅ 2026-05-13（停用时自动交接，可通过 successorId 指定接任者）
- [x] ~~重新启用已停用用户~~ ✅ 2026-05-13（PUT /api/admin/users/:id/activate）

> 框架层通用 RBAC 页面 `pages/system/roles.vue` + `pages/system/user-roles.vue` 已拆出，DocFlow 业务侧栏不展示（注释保留），抽离 starter 模板时启用。

### 2.9 个人中心 (`pages/profile.vue`)

- [x] ~~5 Tab 结构（全部/我创建的/分享给我的/个人收藏/离职移交）~~ ✅ 2026-04-18
- [x] ~~状态筛选 + 关键词搜索 + 分页~~ ✅ 2026-04-18
- [x] ~~来源徽章（mine/shared/favorite）+ 权限级别徽章（可编辑/可阅读）~~ ✅ 2026-04-18
- [x] ~~操作矩阵 A 阶段：查看 / 下载 / 撤回 / 删除草稿~~ ✅ 2026-04-28（下载按钮激活，已发布文档可直接下载）
- [x] ~~操作矩阵 B 阶段：PRD §6.5.2 全矩阵对齐~~ ✅ 2026-05-14（9 种状态×来源组合全覆盖、取消收藏、更多菜单、编辑副本冲突弹窗）
- [x] ~~离职交接手风琴视图 + 仅部门负责人可见~~ ✅ 2026-04-18
- [x] ~~编辑（要文件编辑器）~~ ✅ 2026-05-11
- [x] ~~分享（要 share-links 模块）~~ ✅ 2026-04-29（个人中心已发布文档增加"分享"按钮，复用 ShareLinkModal）
- [x] ~~下载（要文件存储）~~ ✅ 2026-04-28（个人中心已发布文档可直接下载）
- [x] ~~提交发布（要审批发起）~~ ✅ 2026-04-29（PublishModal + POST /api/documents/:id/publish，双模式：全新发布/版本迭代）
- [x] ~~转移归属人~~ ✅ 2026-05-04（OwnershipTransferModal 集成 profile.vue；transfer.post/put.ts 含 M10/M11 通知 2026-05-02）
- [x] ~~申请编辑权限~~ ✅ 2026-05-04（requestEdit action 接入 profile.vue + file/[id].vue PermissionRequestReviewModal；permission-requests.post.ts 含 M14/M15/M16 通知 2026-05-02）

## 三、Composable / 工具函数

| 名称 | 用途 |
|------|------|
| ~~useConfirmAction~~ | ~~统一的「确认→执行→反馈」封装（删除/恢复/回滚等危险操作）~~ ✅ 2026-05-13 |
| ~~useBatchSelect~~ | ~~表格批量选中状态管理（全选/反选/已选计数）~~ ✅ 2026-05-13 |
| ~~useNotificationBadge~~ | ~~通知未读数管理（WebSocket 推送+本地缓存）~~ ✅ 2026-05-13 |
| ~~formatActivity~~ | ~~日志描述格式化工具函数~~ ✅ 2026-05-13 |

## 四、第三方库

| 库 | 用途 | 优先级 |
|----|------|--------|
| ~~sortablejs / @types/sortablejs~~ | ~~审批链节点拖拽排序~~ ✅ 2026-05-13（GroupApprovalPanel 已集成） | ~~高~~ |
| ~~pdfjs-dist~~ | ~~PDF 全屏预览（页级导航）~~ ✅ 2026-05-13（DocPreview url prop 驱动 canvas 渲染） | ~~中~~ |
| ~~@tiptap/vue-3 系列 **或** @milkdown/kit (Crepe)~~ | ~~在线富文本编辑~~ ✅ 2026-05-11（Milkdown Crepe 已使用） | ~~低~~ |
| ~~yjs + y-websocket + @milkdown/plugin-collab~~ | ~~CRDT 多人协同~~ ✅ 2026-05-13（`yjs@^13.6.30` + `y-websocket@^3.0.0` + `@milkdown/plugin-collab@^7.20.0` 均已安装，MilkdownEditor.vue 已接入 Hocuspocus Docker 服务） | ~~低~~ |

> **编辑器技术选型参考**：[markdowm-sample](https://github.com/empty-byte/markdowm-sample) 仓库已验证 **Milkdown (Crepe) + Yjs + Hocuspocus** 方案，覆盖 WYSIWYG 编辑、Slash 菜单、选区评论锚点、历史快照还原、多人协同。启动编辑器开发时可直接参考或复用，也可与 tiptap + Yjs 做横向 POC 对比。

## 五、样式层

- [x] ~~审批链节点样式~~ ✅ 2026-05-13（已确认在 `_doc-preview.scss` 内 `.df-approval-chain` 完整实现）
- [x] ~~状态徽标统一样式体系~~ ✅ 2026-05-13（`.df-badge` 系列 + 暗色覆写已追加至 `_doc-preview.scss` / `dark.scss`）
- [x] ~~操作类型 chips 样式~~ ✅ 2026-05-13（`.action-chip` 系列已追加至 `_data-table.scss` / `dark.scss`）
- [x] ~~仓库卡片样式~~ ✅ 2026-05-13（`.group-card` / `.repo-card` 已追加至 `_list-shell.scss` / `dark.scss`）
- [x] ~~文件头信息区样式~~ ✅ 2026-05-13（已确认在 `_doc-preview.scss` `.file-meta-header` 完整实现）
- [x] ~~评论线程样式~~ ✅ 2026-05-13（已确认在 `_comments.scss` 完整实现）
- [x] ~~全屏查看器工具栏样式~~ ✅ 2026-05-13（已确认在 `FullscreenPreviewer.vue` scoped style 完整实现）

## 六、数据层

- [x] ~~版本列表 API 接真实数据库~~ ✅ 2026-04-28（GET /api/documents/:id/versions 查询真实表 + JOIN uploader + 分页）
- [x] ~~版本对比 API 接真实文件存储~~ ✅ 2026-04-28（POST /api/version/compare 读 MinIO 文件 + diff 算法 + HTML 渲染）
- [x] ~~回滚 API 与事务~~ ✅ 2026-04-27（POST /api/documents/:id/rollback — 复用目标版本 storage_key 生成新版本 + 前端 VersionSidebar 按钮 + canRollback 读端字段）
- [x] ~~上传新版本 API~~ ✅ 2026-04-28（POST /api/documents/:id/versions + multipart 解析 + 格式转换 + 版本号自增 + executeUpload(mode='update')）
- [x] ~~审批流 CRUD API~~ ✅ 2026-04-28（submit/approve/reject/withdraw + 审批模板 GET/PUT，全部真实实现）
- [x] ~~文档 CRUD API~~ ✅ 2026-04-28（list/get/upload/新版本/草稿删除/从组移除/批量移除/下载/预览/权限/收藏/置顶/评论/跨组移动，23 个端点全部真实实现）
- [x] ~~通知 API~~ ✅ 2026-04-18（4 接口已完成，见「七、通知触发点接入清单」）
- [x] ~~收藏 / 置顶 API~~ ✅ 2026-04-24（POST/DELETE favorite + POST/DELETE pin + canPin 读端扩展 + purge 级联清理）
- [x] ~~日志查询 API~~ ✅ 2026-04-28（GET /api/logs 查询真实表，支持类型/关键词/日期筛选 + 分页，38+ 处埋点写入）

---

## 七、通知触发点接入清单

> M1-M24 各消息归属模块和触发点。开发对应业务模块时对照此表接入
> `NOTIFICATION_TEMPLATES.Mx.build(...)`，接入后打 ✅ 并写完成日期。
> 权威源：`server/constants/notification-templates.ts`

| 消息 | 归属模块 | 触发点 | 状态 |
|---|---|---|---|
| M1 | approval-runtime | 文件提交审批 — 通知当前审批人 | ✅ 2026-04-24（`document-upload.ts` executeUpload） |
| M2 | approval-runtime | 审批流转下一级 — 通知下一级 | ✅ 2026-04-24（`approvals/[id]/approve.post.ts`） |
| M3 | approval-runtime | 最后一级通过 — 通知提交人 | ✅ 2026-04-24（同上） |
| M4 | approval-runtime | 任一级驳回 — 通知提交人 | ✅ 2026-04-24（`approvals/[id]/reject.post.ts`） |
| M5 | approval-runtime | 超时 24h 催办 — 通知该步审批人 | ✅ 2026-04-24（cron `approval:remind-timeout`） |
| M6 | approval-runtime | 催办达上限 — 通知提交人 | ✅ 2026-04-24（同上） |
| M7 | approval-runtime | 提交人撤回 — 通知已参与审批人 | ✅ 2026-04-24（`approvals/[id]/withdraw.post.ts`） |
| M8 | document-lifecycle | 新版本发布 — 通知归属人+编辑成员+管理员 | ✅ 2026-04-24（`document-upload.ts` notifyPublishToGroupMembers） |
| M9 | document-lifecycle | 管理员从组移除文件 — 通知归属人 | ✅ 2026-04-24（`documents/[id]/remove.put.ts`） |
| M10 | ownership-transfer | 发起归属人转移 — 通知新归属人 | ✅ 2026-05-02（`documents/[id]/transfer.post.ts`） |
| M11 | ownership-transfer | 转移同意/拒绝/过期 — 通知发起人 | ✅ 2026-05-02（`documents/[id]/transfer.put.ts`） |
| M12 | cross-move | 发起跨组移动 — 通知目标组负责人 | ✅ 2026-04-28（`documents/[id]/move.post.ts`） |
| M13 | cross-move | 移动同意/拒绝/过期 — 通知发起人 | ✅ 2026-04-28（`documents/cross-move/[id]/review.put.ts`） |
| M14 | permission-request | 阅读权限申请 — 通知归属人 | ✅ 2026-05-02（`documents/[id]/permission-requests.post.ts` type=1） |
| M15 | permission-request | 编辑权限申请 — 通知归属人 | ✅ 2026-05-02（`documents/[id]/permission-requests.post.ts` type=2） |
| M16 | permission-request | 权限审批结果 — 通知申请人 | ✅ 2026-05-02（`documents/[id]/permission-requests/[requestId].put.ts`） |
| M17 | share | 分享文档 — 通知被分享人 | ✅ 2026-04-28（`share/[token].get.ts` 打开链接时通知创建者） |
| M18 | group-member | 被加入组 — 通知被添加成员 | ✅ 2026-04-28（`groups/:id/members POST` handler） |
| M19 | group-member | 成员权限变更 — 通知被变更成员 | ✅ 2026-04-28（`groups/:id/members/:memberId PUT` handler） |
| M20 | group-member | 被移出组 — 通知被移出成员 | ✅ 2026-04-28（`groups/:id/members/:memberId DELETE` handler） |
| M21 | role-assign | 管理员角色指派/撤销 | ✅ 2026-05-13（`assign.post.ts`、`revoke.post.ts`、`admin/users/[id]/roles.put.ts`） |
| M22 | group-owner | 组负责人变更 | ✅ 2026-05-13（`groups/[id].put.ts` ownerId 字段 + M22 通知全组成员） |
| M23 | hr-handover | 员工离职交接 | ✅ 2026-05-13（`admin/users/[id]/deactivate.put.ts` — 部门范围组交接时通知部门负责人） |
| M24 | approval-chain-change | 审批链成员因离职/调岗移除 | ✅ 2026-05-13（`admin/users/[id]/deactivate.put.ts` — 移除审批链节点时通知组负责人） |
| M25 | feishu-dept-revoke | 飞书部门撤销 — 通知部门负责人+系统管理员 | ✅ 2026-05-14（`server/utils/feishu.ts` 飞书同步检测） |
| M26 | document-reference | 源文档被移除/删除，引用自动失效 — 通知目标组管理员 | ✅ 2026-05-14（`server/utils/document-reference.ts`） |
| M27 | annotation-mention | 批注中 @提及用户 — 通知被提及人 | ✅ 2026-05-18（`annotations.post.ts` + `replies.post.ts`） |

**开发流程：** 做某业务模块前 → `grep "triggerModule: 'xxx'" server/constants/notification-templates.ts` 反查 M 码 → 依模板接入 → 本表打 ✅ + 日期。

**飞书推送：** ✅ 2026-05-14 已在 `server/utils/notify.ts` 统一入口中集成。`createNotification` / `createNotifications` 写入站内通知后自动推送飞书交互卡片，M1-M27 全部覆盖，无需逐 API 修改。

**延迟项**：
- `/docs/repo/[id].vue` 页的 `?openSettings=approval` query 自动打开组设置审批配置 Tab，因 repo 页当前未集成 GroupSettingsModal，推迟到 repo 页整合时一并实现。通知中心 M24 卡片点击会跳到 `/docs/repo/:id?openSettings=approval`，目前只跳转不自动开弹窗。

---

## 八、在线编辑器

| 功能 | 完成日期 |
|------|----------|
| 在线 Markdown 编辑器（Milkdown Crepe） | ✅ 2026-05-11 |
| 新建草稿 / 编辑草稿 / 编辑副本三种模式 | ✅ 2026-05-11 |
| 2秒防抖自动保存（draft_content 字段） | ✅ 2026-05-11 |
| 发布时材料化 draft_content → MinIO | ✅ 2026-05-11 |
| Hocuspocus 协同服务（Docker） | ✅ 2026-05-11 |
| 批注 CRUD（GET/POST/PUT/DELETE） | ✅ 2026-05-11 |
| AnnotationPanel 批注面板组件 | ✅ 2026-05-11 |
| 选字浮层 + 批注输入面板（AnnotationSelector） | ✅ 2026-05-16 |
| 批注正文高亮 + 点击定位 | ✅ 2026-05-16 |
| 批注右侧面板布局（文件详情页 / 编辑器 / 全屏） | ✅ 2026-05-16 |
| 批注回复功能 + 筛选TAB + 头像 | ✅ 2026-05-16 |

### 批注待办（后续迭代）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| ~~冻结不可逆持久化~~ | ~~当前 frozen 运行时计算（对比 version_id），版本回退时旧批注会解冻。需改为 DB 字段持久化~~ ✅ 2026-05-18 | ~~P2~~ |
| ~~审批中心批注集成~~ | ~~PRD 要求审批人可在审批预览中添加批注作为修改意见，当前 ApprovalDrawer 无批注集成~~ ✅ 2026-05-18 | ~~P2~~ |
| ~~@提及 + 通知~~ | ~~PRD 要求批注中 @某人自动发送消息通知~~ ✅ 2026-05-18 | ~~P3~~ |
| ~~多批注重叠高亮 + 数字角标~~ | ~~同一文本被多条批注覆盖时显示角标提示重叠数量~~ ✅ 2026-05-18 | ~~P3~~ |

### PRD §2.3 名词定义对比 — 实现偏差（2026-05-18 审计）

| 编号 | 术语 | PRD 定义 | 当前状态 | 偏差说明 | 优先级 |
|------|------|----------|----------|----------|--------|
| G-T1 | 飞书同步人员删除保护 | ~~飞书同步的成员不可手动删除~~ | ⚠️ 偏差 | ✅ 2025-05-19 | 删除接口增加 source_type=2 检查，飞书同步成员返回403拒绝移除 | P2 |
| G-T2 | 角色升级 | 负责人离职时角色自动转给上级，无需同意（区别于归属人转移） | ❌ 未实现 | 当前 `deactivateUser()` 交接给指定接任者或 fallback 管理员，无"自动查找上级"逻辑 | P3 |
| G-T3 | 飞书消息提醒中心 | 所有外发飞书消息的统一管理页面（≠ 站内通知中心） | ❌ 未实现 | 当前飞书推送附随站内通知自动发出，无独立的飞书消息查看/管理界面 | P3 |

### PRD §三 产品功能清单 — 实现偏差（2026-05-18 审计）

| 编号 | 模块 | 功能项 | PRD 说明 | 当前状态 | 偏差说明 | 优先级 |
|------|------|--------|----------|----------|----------|--------|
| G-F1 | 文件操作 | ~~跨组批量移动~~ | 单文件或批量多选移动到目标组，含权限处理 | ✅ 2025-05-19 | 新增 batch-move.post.ts 接口 + 前端 BulkActionBar 批量移动按钮，复用 MoveTargetPicker 弹窗 | P2 |
| G-F2 | 操作日志 | ~~按角色分范围查看~~ | 自动记录所有关键操作，按角色分范围查看 | ✅ 2025-05-19 | 新增 buildLogScopeFilter 工具函数，super/company_admin全量，dept_head看本部门，pl_head看本产品线，其他看自己+所在组 | P2 |
| G-F3 | 文件评论 | 表情支持 | 评论列表支持表情 | ❌ 未实现 | 评论 CRUD + 回复 + 删除已有，缺少 emoji reaction 功能 | P3 |
| G-F4 | 飞书集成 | 云文档归档拉取评论 | 飞书 Bot/DocFlow 内双入口，拉取内容+评论 | ⚠️ 部分完成 | 归档已实现（拉取 raw_content + 转 MD），**未同步拉取飞书文档评论** | P3 |
| G-F5 | 系统管理 | 全局配置管理页面 | 系统级参数配置 | ⚠️ 部分完成 | 后端 `doc_system_config` 表 + 读取工具已有，**缺前端管理界面** | P3 |
| G-F6 | 权限矩阵 | ~~上传下载角色在线编辑限制~~ | 上传下载(role=3)仅可编辑自己上传的文件 | ✅ 2026-05-19 | edit-copy.post.ts 增加 role=3 非 owner 拦截；documents/index.get 返回 canEditInGroup；GroupFilesPanel 前端双重判断 | P2 |
| G-F7 | 权限矩阵 | ~~上传下载角色分享限制~~ | 上传下载(role=3)分享仅可选"可阅读" | ✅ 2026-05-19 | share/create.post.ts 新增 group role=3 拦截，permission=2 时返回 403；前端 detail 页已通过 canEdit prop 控制 | P2 |
| G-F8 | 状态流转 | 邀请协同编辑入口 | 个人中心编辑中状态可邀请他人进入协同房间 | ⚠️ 部分完成 | 协同编辑本身已实现，但缺少编辑器内显式的"邀请协同"入口（发通知/链接邀人进入编辑房间） | P3 |
| G-F9 | 产品流程 | ~~组负责人交接-审批链替换~~ | 交接时将旧负责人在审批链中的节点自动替换为新负责人 | ✅ 2026-05-19 | transfer-leader.post.ts 事务中同步替换审批模板节点 + 进行中审批实例待审节点的 approver_user_id | P2 |
| G-F10 | 共享文档 | ~~非组成员可见范围限制~~ | 非组成员只能看到组名列表，看不到组内文档 | ✅ 2026-05-19 | documents/index.get 新增 canUserAccessGroup 校验；tree.get 按用户权限过滤 files 数组 | P2 |
| G-F11 | 共享文档 | ~~系统管理员继承显示~~ | 系统管理员自动继承到公司层下所有子组，在成员列表中显示且不可删除/降权 | ✅ 2025-05-19 | members GET API 查询 super_admin 用户追加为虚拟继承成员（role=1, sourceType=3, immutableFlag=1） | P3 |
| G-F12 | 按部门 | ~~部门负责人换人时继承成员同步~~ | 飞书同步部门主管变更时，所有子组中旧负责人的继承成员记录应替换为新负责人 | ✅ 2025-05-19 | feishu.ts 同步逻辑 step 6.1 新增旧负责人检测 + 调用 syncInheritedMembers() 批量替换继承成员 | P2 |
| G-F13 | 按部门 | ~~移除部门管理员阻塞校验~~ | 若管理员仍是某子组的组负责人，应阻塞移除并提示先移交 | ✅ 2025-05-19 | admins/[userId].delete.ts 新增 doc_groups owner_user_id 校验，仍是组负责人则 409 阻塞 | P2 |
| G-F14 | 按部门 | ~~部门管理员可见范围~~ | 部门管理员只能看到自己创建的子组（部门负责人可见全部） | ✅ 2025-05-19 | groups.get 判断是否 dept_head/super_admin，非负责人仅返回 owner_user_id = user.id 的组 | P3 |
| G-F15 | 按产品线 | ~~产品线编辑/删除权限过紧~~ | PRD 允许产品线负责人编辑基本信息和删除产品线 | ✅ 2025-05-19 | PUT/DELETE product-lines/:id 权限放宽为 super_admin OR 产品线负责人 | P2 |
| G-F16 | 按产品线 | ~~产品线负责人变更功能~~ | 支持变更产品线负责人，并同步替换所有子孙组中的继承成员 | ✅ 2025-05-19 | PUT /api/product-lines/:id 新增 ownerUserId 字段，变更时同步 pl_head 角色授予/撤销 + syncInheritedMembers 子组继承成员替换 | P2 |
| G-F17 | 按产品线 | ~~管理员移除阻塞校验~~ | 若管理员仍是某子组的组负责人，应阻塞移除 | ✅ 2025-05-19 | product-lines admins/[userId].delete.ts 新增 doc_groups owner_user_id 校验，仍是组负责人则 409 阻塞 | P2 |
| G-F18 | 创建组 | ~~组名称/描述校验规则偏差~~ | PRD: 名称≤50字符+禁止特殊字符(/\:?"<>\)；描述≤200字符 | ✅ 2025-05-19 | schema + 前端 maxlength + rules 全部对齐 PRD | P3 |
| G-F19 | 全局搜索 | ~~搜索结果缺少 PRD 要求的细节~~ | PRD: 组显示所属层级badge、文档显示版本号、结果显示计数、顶部"仅显示有权限的内容"提示 | ✅ 2025-05-19 | API 增加 scopeType/versionNo，前端加 badge、版本号、计数标题、权限提示 | P3 |
| G-F20 | 文件列表 | ~~收藏按钮非独立列~~ | PRD 要求行尾独立星形按钮切换收藏 | ✅ 2025-05-19 | 表格新增收藏列，独立星形按钮一键切换 | P3 |
| G-F21 | 文件列表 | ~~审批提示条缺跳转链接~~ | PRD 要求"前往审批中心→"链接(reviewing>0 时显示) | ✅ 2025-05-19 | banner 末尾添加 NuxtLink 跳转 /approvals | P3 |
| G-F22 | 文件列表 | ~~子组卡片缺成员数~~ | PRD 要求卡片显示成员数 | ✅ 2025-05-19 | tree API 加 member_count，卡片 footer 显示 | P3 |
| G-F23 | 文件列表 | ~~编辑副本确认弹窗~~ | PRD 要求结构化弹窗(目标文件+版本+归属人+黄色警告) | ✅ 2025-05-19 | 已发布文档编辑前弹出确认框，展示文件名/版本/归属人+警告提示 | P3 |
| G-F24 | 文件列表 | 跨组移动弹窗细节 | PRD 要求搜索框+展示目标组成员权限列表+通知提示 | ⚠️ 偏差 | MoveTargetPicker 缺搜索功能、目标组成员展示、通知文案 | P3 |
| G-F25 | 文件列表 | 飞书导入缺更新导入模式 | PRD 支持"更新导入"(关联已有文件+版本递增) + 映射飞书协作者权限 | ⚠️ 部分完成 | 仅支持首次导入模式；未获取飞书文档协作者映射为 DocFlow 可编辑权限 | P2 |
| G-F26 | 文件详情 | Presence 头像组为静态数据 | PRD 要求显示"当前正在查看该文档的人"(实时 WebSocket) | ⚠️ 偏差 | AvatarStack 的 collaborators 来源为版本上传者去重，非实时在线用户推送 | P2 |
| G-F27 | 文件详情 | 飞书评论 TAB 缺失 | PRD 要求飞书导入文档有"飞书评论"第三 TAB + 导入飞书原始评论入口 | ❌ 缺失 | 底部仅评论+审批记录两个 TAB，无飞书评论相关功能（与 G-F4 关联） | P3 |
| G-F28 | 文件详情 | ~~页内版本对比缺同步滚动~~ | PRD 要求左右并排同步滚动 | ✅ 2025-05-19 | 页内对比双 el-scrollbar 添加 onCompareScroll 同步滚动，rAF 防止循环触发 | P3 |
| G-F29 | 在线编辑器 | Presence 头像组 UI 未渲染 | PRD 要求顶栏显示当前在线协作者头像(最多3+溢出数字)，hover 姓名列表，点击 toast 全部 | ❌ 缺失 | 后端 Awareness 数据已通过 @presence-update 收集到 onlineUsers，但模板中完全无渲染 | P2 |
| G-F30 | 在线编辑器 | TOC 目录侧栏缺失 | PRD 要求左侧显示文档目录(类飞书)，可折叠 | ❌ 缺失 | 编辑器页面无 TOC 侧栏实现 | P2 |
| G-F31 | 在线编辑器 | ~~下载按钮缺失~~ | PRD 要求顶栏有下载按钮，toast"已下载"并触发文件下载 | ✅ 2025-05-19 | 顶栏增加下载按钮，导出 .md 文件 + toast 提示 | P3 |
| G-F32 | 在线编辑器 | ~~删除/取消编辑入口缺失~~ | PRD 要求：新建/草稿→confirm 后软删除到回收站；编辑副本→confirm 提示"取消编辑将不保存修改" | ✅ 2026-05-19 | 编辑器更多菜单新增"删除草稿/取消编辑"；draft.delete.ts 扩展支持 status=2 | P2 |
| G-F33 | 在线编辑器 | ~~标题校验规则偏差~~ | PRD 要求 maxlength=100 且禁止 `/\:*?"<>\|` 特殊字符 | ✅ 2025-05-19 | 前端 maxlength=100 + 实时过滤特殊字符，后端 schema 同步对齐 | P3 |
| G-F34 | 在线编辑器 | ~~提交发布 confirm 文案缺失~~ | PRD 要求先弹出 confirm："提交后将进入审批流程，审批期间文档不可编辑..." | ✅ 2025-05-19 | handlePublish 添加 msgConfirm 前置确认 | P3 |
| G-F35 | 在线编辑器 | ~~hocuspocus 缺文档级权限校验~~ | PRD 要求上传下载角色不能加入协同房间 | ✅ 2026-05-19 | hocuspocus onAuthenticate 新增文档级权限校验（归属人/组编辑/文档级权限/系统管理员四路判定）+mysql2连接池 | P1 |
| G-F36 | 在线编辑器 | ~~返回路径未区分来源~~ | PRD 要求来自共享文档→返回 repos；来自个人中心→返回 personal | ✅ 2025-05-19 | 跳转时传 from query，handleBack 根据来源路由 | P3 |
| G-F37 | 历史快照 | ~~Ctrl+S 手动保存缺失~~ | PRD 要求 Ctrl+S 触发手动保存（type=2），创建快照记录 | ✅ 2026-05-19 | 编辑器注册 keydown 监听，Ctrl/Cmd+S 阻止默认行为并立即 flushSave | P2 |
| G-F38 | 历史快照 | ~~当前活跃蓝色圆点缺失~~ | PRD 要求时间线上当前活跃节点使用蓝色实心圆点区分 | ✅ 2025-05-19 | 第一个节点添加 --active 修饰符，蓝色圆点 + 外发光 | P3 |
| G-F39 | 历史快照 | ~~版本节点不支持预览~~ | PRD 要求版本节点也可预览（在编辑区临时只读展示） | ✅ 2025-05-19 | 版本预览改用 apiPreviewDocument(docId, versionId) | P3 |
| G-F40 | 历史快照 | ~~共享文档应隐藏快照~~ | PRD 要求共享文档仅展示版本节点，隐藏编辑快照 | ✅ 2025-05-19 | snapshots.get 按用户权限区分：编辑者(owner/组role<=2/perm<=2)可看快照+版本，只读用户仅看版本 | P2 |
| G-F41 | 历史快照 | ~~命名快照入口偏差~~ | PRD 要求在顶栏"..."菜单内直接创建快照 | ✅ 2025-05-19 | "..."菜单增加"保存快照"项，直接调 API 无需先开抽屉 | P3 |
| G-F42 | 历史快照 | ~~返回时未创建快照记录~~ | PRD 要求返回上级页面时触发保存（与自动保存同类型） | ✅ 2025-05-19 | handleBack 中 flushSave 后 fire-and-forget 调 apiCreateSnapshot | P3 |
| G-F43 | 协同编辑 | ~~房间无生命周期管理~~ | PRD 要求文档发布/删除时销毁房间 | ✅ 2026-05-19 | hocuspocus 新增管理端点 POST /close-room；主应用 closeCollabRoom() 工具函数在发布/删除/移除时通知关闭 | P1 |
| G-F44 | 协同编辑 | 批注未走实时同步通道 | PRD 要求批注新增/回复/解决实时同步（独立于正文） | ❌ 缺失 | 批注完全走 HTTP REST API，多人同时批注看不到对方实时新增 | P2 |
| G-F45 | 协同编辑 | ~~Presence 心跳未配置 5s~~ | PRD 要求 5s 心跳超时即标记离线 | ✅ 2025-05-19 | hocuspocus Server.configure 添加 timeout: 5000 | P2 |
| G-F46 | 协同编辑 | ~~光标位置同步缺 100ms 节流~~ | PRD 要求光标位置 100ms 节流同步 | ✅ 2025-05-19 | awareness.setLocalStateField 对 cursor/selection 字段添加 100ms 节流 | P3 |
| G-F47 | 协同编辑 | 飞书邀请协作未实现 | PRD 要求创建者可在飞书中邀请协作者加入房间 | ❌ 缺失 | 全局无飞书邀请协作相关代码 | P2 |
| G-F48 | 协同编辑 | ~~发布后组成员权限自动分配~~ | PRD 要求草稿发布后组内成员自动获得"可编辑"权限 | ✅ 2025-05-19 | 新增 grantGroupMembersEditPermission 工具函数，审批通过和直接发布均调用，为组成员批量写入 permission=2 | P2 |
| G-F49 | 链接分享 | ~~共享文档列表行右键"复制分享链接"缺失~~ | PRD 要求共享文档列表行右键菜单含"复制分享链接"入口 | ✅ 2025-05-19 | 操作菜单增加"复制分享链接"项，使用 clipboard API | P3 |
| G-F50 | 链接分享 | ~~分享权限约束基于全局 RBAC 而非文档级~~ | PRD 要求分享权限不能超过分享人**对该文档**的权限级别 | ✅ 2025-05-19 | create.post 改为文档级权限校验：owner可任意分享，组role<=2或docPerm<=2可分享编辑，否则仅可分享阅读 | P2 |
| G-F51 | 链接分享 | ~~编辑器/个人中心入口未传 canEdit prop~~ | PRD 要求可阅读用户不可选"可编辑"选项 | ✅ 2025-05-19 | 两处 ShareLinkModal 显式传 :can-edit="true" | P3 |
| G-F52 | 选字批注 | ~~选字长度限制边界偏差~~ | PRD 要求 1~500 字符 | ✅ 2025-05-19 | 条件改为 `<1 \|\| >500` | P3 |
| G-F53 | 选字批注 | ~~编辑副本提示未解决批注时机不符~~ | PRD 要求在创建确认弹窗中追加提示行（事前） | ✅ 2025-05-19 | onEdit 前置确认弹窗中查询未解决批注数并追加警告提示 | P3 |
| G-F54 | 选字批注 | ~~冻结卡片灰度样式待补~~ | PRD 要求冻结批注卡片整体灰度 60% | ✅ 2025-05-19 | 添加 .annotation-item--frozen { opacity: 0.6; pointer-events: none } | P3 |
| G-F55 | 归属人转移 | ~~飞书卡片缺组名和版本信息~~ | PRD 卡片要求含"文档所在组: {组名}/{部门or产品线}"+"当前版本: v{X.Y}" | ✅ 2025-05-19 | M10 模板 build 新增 groupName/versionNo 参数，content 字段展示；transfer.post 查询 group+version 传入 | P3 |
| G-F56 | 归属人转移 | 飞书卡片不会就地更新 | PRD 要求同意后卡片更新为"✓已同意"，拒绝后更新为"✗已拒绝" | ❌ 缺失 | 当前只发新通知，不更新原卡片（需飞书 update API + 存储 message_id） | P3 |
| G-F57 | 归属人转移 | ~~同意后未通知新归属人自己~~ | PRD 要求"消息通知双方" | ✅ 2025-05-19 | accept 分支增加对新归属人的 M11 通知 | P3 |
| G-F58 | 审批中心 | 审批模式全屏预览未接通 | PRD 要求审批抽屉内打开全屏预览器(审批模式)，关闭后回到抽屉 | ❌ 缺失 | 当前"查看文件"按钮跳转到文件详情页(from=approval)，非在审批页内打开 FullscreenPreviewer 审批模式 | P2 |
| G-F59 | 审批中心 | ~~全屏预览器缺"上传新版本"入口~~ | PRD 要求普通模式版本侧栏有"上传新版本"按钮 | ✅ 2025-05-19 | FullscreenPreviewer 版本侧栏 header 添加"上传新版本"按钮(仅 normal 模式)，emit upload-version 事件 | P3 |
| G-F60 | 审批中心 | ~~驳回 toast 文案未对齐 PRD~~ | PRD 要求"已驳回，驳回原因已通知提交人" | ✅ 2025-05-19 | 后端 reject API 响应 message 对齐 PRD 文案 | P3 |
| G-F61 | 审批中心 | ~~审批链当前节点样式偏差~~ | PRD 要求当前节点显示蓝色"..."省略号 | ✅ 2025-05-19 | current 节点 avatar 改为显示"..."省略号，保留蓝色背景+脉冲动画 | P3 |
| G-F62 | 个人中心 | ~~文件名不可点击跳转~~ | PRD 要求文件名为链接(草稿/编辑中→编辑器；已发布/审批中→详情页) | ✅ 2026-05-19 | title slot 改为 NuxtLink，getDocLink 按 status+docType 决定跳转目标 | P2 |
| G-F63 | 个人中心 | ~~收藏黄星缺失~~ | PRD 要求已收藏文档在文件名旁显示黄色星标 | ✅ 2025-05-19 | 在 favorite tab 及 all tab source=favorite 时显示黄色 StarFilled 图标 | P3 |
| G-F64 | 个人中心 | ~~搜索非实时过滤~~ | PRD 要求输入框实时过滤（防抖） | ✅ 2025-05-19 | watch filterKeyword + 300ms debounce 自动触发搜索 | P3 |
| G-F65 | 个人中心 | ~~子 Tab 来源列未隐藏~~ | PRD 要求子 Tab（我创建的/分享给我的/个人收藏）不显示来源列 | ✅ 2025-05-19 | columns 改为 computed，非 all tab 时过滤掉来源列 | P3 |
| G-F66 | 个人中心 | ~~编辑中+分享可编辑缺提交发布~~ | PRD 操作矩阵要求编辑中+分享给我的(可编辑)有"提交发布"菜单项 | ✅ 2026-05-19 | personal-matrix 移除 isOwner 限制；publish.post.ts 扩展支持 status=2 + 非 owner 协作者 | P2 |
| G-F67 | 个人中心 | ~~已发布编辑缺前置确认弹窗~~ | PRD 要求已发布(我创建的)点编辑时先弹"编辑副本确认"弹窗 | ✅ 2025-05-19 | onEdit 在调 API 前增加 msgConfirm 前置确认（含文件名+版本号+说明） | P3 |
| G-F68 | 个人中心 | ~~离职移交 TAB 缺 NEW 标记~~ | PRD 要求"离职移交"TAB 旁显示 NEW badge | ✅ 2025-05-19 | TabBar 组件新增 badge 字段支持，handover tab 显示红色 NEW 标记 | P3 |
| G-F69 | 个人中心 | ~~离职移交展开后非表格视图~~ | PRD 要求展开后为文件表格(列: 文件名/版本/状态/原所属组/交接日期/操作) | ✅ 2025-05-19 | HandoverAccordion 改为 el-table 展示，包含文件名/版本/状态/原所属组/交接日期/操作(查看/下载/删除)六列 | P2 |
| G-F70 | 回收站 | ~~预览接口条件冲突可能导致"查看"不可用~~ | PRD 要求查看仅展示改版正文 | ✅ 2025-05-19 | preview.get WHERE 条件与列表对齐为 status=6 AND deleted_at_real IS NOT NULL AND deleted_at IS NULL | P2 |
| G-F71 | 回收站 | ~~缺少"已删除文件 X 个文件"计数文案~~ | PRD 原型顶部显示"已删除文件 N 个文件" | ✅ 2025-05-19 | subtitle 改为动态模板字符串，显示 total 计数 | P3 |
| G-F72 | 回收站 | 未按组分组展示 | PRD 要求列表形式按组分组展示已删除文件 | ⚠️ 偏差 | 当前为普通表格平铺+原组列+组筛选，非"按组分组块"展示 | P3 |
| G-F73 | 操作日志 | ~~文件编辑类日志未落库~~ | PRD 定义"文件编辑"含创建编辑副本/在线编辑保存(自动/Ctrl+S/快照) | ✅ 2025-05-19 | edit-copy.post 写 DOC_DRAFT_CREATE、content.put 写 DOC_EDIT_SAVE、snapshots.post 写 DOC_SNAPSHOT_CREATE | P2 |
| G-F74 | 操作日志 | ~~多个日志子项未实际埋点~~ | PRD 要求完整覆盖所有操作子项 | ✅ 2025-05-19 | 已补充6项埋点：DOC_IMPORT_FEISHU/SHARE_REQUEST_EDIT/MEMBER_FEISHU_SYNC/ANNOTATION_ADD/REPLY/RESOLVE；DOC_MOVE_EXPIRE和OWNERSHIP_HANDOVER无对应端点暂不埋 | P2 |
| G-F75 | 操作日志 | ~~按角色分范围查看未实现~~ | PRD 要求不同角色看到不同范围的日志(已记录于G-F2) | ✅ 2025-05-19 | 同 G-F2，由 buildLogScopeFilter 统一处理 | P2 |
| G-F76 | 通知中心 | 飞书卡片缺按类型操作按钮 | PRD 要求 M10/M12/M14/M15 显示"同意/拒绝"，M6 显示"撤回/查看"，其他显示"查看" | ⚠️ 偏差 | 当前统一只有"查看详情"按钮，未按消息类型区分飞书卡片按钮 | P2 |
| G-F77 | 通知中心 | 飞书卡片按钮回调闭环缺失 | PRD 要求用户在飞书内点击按钮后回调 DocFlow 后端执行操作 | ❌ 缺失 | 无处理卡片按钮动作的 webhook；仅有员工事件和机器人收消息两个 webhook | P2 |
| G-F78 | 通知中心 | ~~飞书卡片内容规范不符~~ | PRD 要求结构化正文(操作人+所属组+操作时间+操作描述) | ✅ 2025-05-19 | buildFeishuCard 标题加粗、content 结构化渲染、追加操作时间行 | P3 |
| G-F79 | 通知中心 | M13 跨组移动过期分支未落地 | PRD 要求移动请求超时自动过期并通知发起人 | ❌ 缺失 | 无跨组移动过期扫描任务，仅有同意/拒绝分支 | P2 |
| G-F80 | 通知中心 | ~~M17 触发语义反转~~ | PRD 要求“有人分享给我→通知被分享人”，当前是“访问链接者触发通知给分享者” | ✅ 2025-05-19 | M17 通知收件人改为被分享人（链接访问者），分享者名称从关联关系获取 | P2 |
| G-F81 | 通知中心 | ~~站内通知卡片缺操作按钮~~ | PRD 要求通知卡片按类型显示“同意/拒绝/查看文件/查看组”等操作按钮 | ✅ 2025-05-19 | NotificationCard 按 msgCode 区分渲染同意/拒绝、撤回/查看、查看三类按钮 | P2 |
| G-F82 | 系统管理 | ~~部门负责人行"角色管理"按钮未禁用~~ | PRD 要求部门负责人行为只读(飞书同步) | ✅ 2025-05-19 | 当 row.roles 含 feishuSynced 的 dept_head 时禁用按钮并提示"飞书同步角色，不可修改" | P3 |
| G-F83 | 文档引用 | ~~添加引用弹窗缺组筛选下拉~~ | PRD 要求有“所有可见组”下拉(排除当前组，显示“组名(N个文件)”) | ✅ 2025-05-19 | 添加 el-select 组筛选，从组树扁平化获取可选组并排除当前组 | P2 |
| G-F84 | 文档引用 | ~~引用行缺浅蓝背景~~ | PRD 要求引用文档行使用 #fafcff 浅蓝背景 | ✅ 2025-05-19 | DataTable 传 rowClassName，引用行添加浅蓝背景色 | P3 |
| G-F85 | 文档引用 | ~~引用图标颜色非主色调~~ | PRD 要求 SVG 链接图标使用主色调 | ✅ 2025-05-19 | 颜色改为 var(--df-primary) | P3 |
| G-F86 | 文档引用 | ~~引用行操作菜单未限管理员~~ | PRD 要求“...”更多(含取消引用)仅组管理员可见 | ✅ 2025-05-19 | 取消引用菜单项加 canManagePermissions 条件判断 | P2 |
| G-F87 | 文档引用 | ~~引用行仍可能出现非法操作~~ | PRD 要求引用行仅含“详情”+“取消引用” | ✅ 2025-05-19 | 引用行菜单独立分支，仅展示下载/置顶/取消引用，不展示编辑/收藏/移动等 | P2 |
| G-F88 | 文档引用 | ~~引用文档详情页缺差异化处理~~ | PRD 要求引用详情页有只读提示条/标题链接图标/仅下载按钮/返回目标组 | ✅ 2026-05-19 | ?ref=groupId 引用模式：蓝色提示条+Link图标+仅下载按钮+返回引用组 | P1 |
| G-F89 | 文档引用 | ~~取消引用确认框不符 PRD~~ | PRD 要求含文档信息卡片(灰色背景+来源)+补充说明文字 | ✅ 2025-05-19 | 确认框展示文件名/来源组/版本+补充说明文字 | P3 |
| G-F90 | 文档引用 | ~~批量移除未触发引用自动失效~~ | PRD 要求源文档被移除时自动删除引用+通知 | ✅ 2026-05-19 | batch-remove.post.ts 事务后调用 cleanupDocumentReferences + closeCollabRoom | P1 |
| G-F91 | 文档引用 | ~~翻页器缺"含 N 条引用"标注~~ | PRD 要求分页器标注"含 N 条引用" | ✅ 2025-05-19 | Pagination 新增 hint prop，DataTable 透传 paginationHint，GroupFilesPanel 计算引用数显示 | P3 |
| G-F92 | 文档引用 | ~~搜索接口缺可见组权限过滤~~ | PRD 要求仅展示管理员有权限查看的组的文档 | ✅ 2025-07-14 | references/search.get.ts 新增可见组过滤：super_admin/company_admin 可见全部，其他用户仅返回成员组+组负责人+dept_head/pl_head 管辖范围组的文档 | P2 |
| G-F93 | 文档引用 | ~~引用置顶上下文不一致~~ | PRD 要求引用文档置顶在引用组生效(独立于源组) | ✅ 2025-05-19 | pin.post/delete 新增 groupId 参数支持引用组独立置顶；前端 GroupFilesPanel 为引用文档展示置顶按钮并传递当前组 ID | P2 |
| G-F94 | 非功能-安全 | JWT 会话默认时长与 PRD 不一致 | PRD 要求"JWT Token 默认 8 小时" | ⚠️ 偏差 | 当前采用双令牌(access 15m + refresh 7d)，非单令牌 8h。安全性更优但与 PRD 定义不同 | P3 |
| G-F95 | 非功能-安全 | 文件下载非服务端流式传输 | PRD 要求"通过鉴权后流式传输" | ⚠️ 偏差 | 当前鉴权后返回 MinIO 预签名 URL 让客户端直连下载，非服务端流式代理。预签名有时效但理论上可在有效期内被转发 | P3 |
| G-F96 | 非功能-安全 | ~~操作日志缺 DB 层面不可篡改保障~~ | PRD 要求"操作日志不可篡改，仅 INSERT" | ✅ 2025-05-19 | 新增 BEFORE UPDATE/DELETE 触发器 SIGNAL 45000 阻止修改删除；patch-001 交付 | P2 |
| G-F97 | 非功能-性能 | ~~未见并发用户上限配置~~ | PRD 要求"支持 50 人同时在线" | ✅ 2025-05-19 | hocuspocus 配置 maxConnections: 50 | P3 |
| G-F98 | 非功能-视觉 | ~~图标风格未完全统一为线性~~ | PRD 要求“统一线性图标风格” | ✅ 2025-05-19 | WarningFilled→Warning, SuccessFilled→CircleCheck, CircleCloseFilled→CircleClose, BellFilled→Bell | P3 |
| G-F99 | 非功能-视觉 | 加载态未全面使用骨架屏 | PRD 要求"骨架屏代替 Loading 转圈" | ⚠️ 偏差 | app.vue/编辑器/StatsCard 有骨架屏，但列表页(审批/通知/文档)主要仍用 v-loading 遮罩转圈 | P3 |

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
