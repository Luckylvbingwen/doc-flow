# DocFlow 功能差距清单

> 基于 `prototype-v4.html` 原型与 `企业文档管理系统PRD.md` 综合分析，记录当前待补充的功能项。  
> 已完成的功能会从对应分类中移除。  
> 最后更新：2026-03-31

---

## 一、公共组件

| 组件 | 用途 | 使用页面 |
|------|------|----------|
| EmptyState | ~~统一空态（图标+文字+可选操作按钮）~~ ✅ 已完成 | ~~几乎所有列表页~~ |
| BulkActionBar | 批量操作浮动条（已选N项+操作按钮组） | docs、recycle-bin |
| FileMetaHeader | 文件头信息条（图标+名称+类型+大小+创建人+时间） | file/[id]、approvals |
| ApprovalDrawer | 审批详情抽屉（文件卡+审批链+意见区+操作按钮） | approvals、file/[id] |
| ApprovalChain | ~~审批流程节点可视化（发起→审批人→…→完成）~~ ✅ 已完成 | ~~approvals、file/[id]~~ |
| CommentThread | 评论线程（头像+内容+时间+回复） | file/[id] |
| ActivityFilterBar | 日志筛选条（搜索+时间范围+操作类型 chips） | logs |
| MemberPicker | 成员选择器（搜索+列表+已选标签） | repo 设置、admin |
| PermissionEditor | 权限编辑弹窗（继承/自定义+角色矩阵） | repo 设置、file/[id] |
| MoveTargetPicker | 跨组移动目标选择器（复用 DocNavTree） | file/[id]、docs |
| StatsCard | 统计数字卡片（数字+标签+趋势图标） | admin、docs 首页 |

## 二、页面交互补全

### 2.1 审批管理 (`pages/approvals.vue`)

- [ ] 审批抽屉（ApprovalDrawer 集成）
- [ ] 审批链可视化（ApprovalChain 集成）
- [ ] 驳回必填校验（驳回时意见为必填项）
- [ ] 变更摘要展示（文件版本变更内容概要）
- [ ] 撤回操作
- [ ] 超时催办状态

### 2.2 操作日志 (`pages/logs.vue`)

- [ ] 搜索框（关键词搜索）
- [ ] 时间范围选择器
- [ ] 操作类型筛选 chips
- [ ] 分页功能
- [ ] 空态展示
- [ ] 日志描述格式化（结构化描述替代纯文本）

### 2.3 通知中心 (`pages/notifications.vue`)

- [ ] 分类 tab（审批通知 / 系统通知 / 成员变更）
- [ ] 未读计数 badge
- [ ] 全部标为已读
- [ ] 已读/未读视觉状态区分

### 2.4 回收站 (`pages/recycle-bin.vue`)

- [ ] 批量选择
- [ ] 恢复确认弹窗
- [ ] 永久删除确认弹窗
- [ ] 来源组信息展示

### 2.5 仓库详情 (`pages/docs/repo/[id].vue`)

- [ ] 文件列表工具栏（排序+视图切换+搜索）
- [ ] 批量操作（勾选+批量删除/移动/下载）
- [ ] 组设置 — 基础设置 tab
- [ ] 组设置 — 成员管理 tab
- [ ] 组设置 — 审批流配置 tab
- [ ] 飞书导入入口

### 2.6 文档主页 (`pages/docs/index.vue`)

- [ ] 右侧文件区（文件列表+网格视图）
- [ ] 子组卡片展示
- [ ] 仓库状态卡片（文件数/成员数/最近更新）
- [ ] 全局搜索栏
- [ ] 悬停更多菜单
- [ ] 创建组/仓库流程

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

## 六、数据层（待 PRD 定稿后推进）

> 以下项依赖数据模型最终确定，当前暂缓。

- [ ] Prisma schema 对齐 doc.sql 版本域
- [ ] 版本列表 API 接真实数据库
- [ ] 版本对比 API 接真实文件存储
- [ ] 回滚 API 与事务
- [ ] 上传新版本 API
- [ ] 审批流 CRUD API
- [ ] 文档/仓库/组 CRUD API
- [ ] 通知 API
- [ ] 日志查询 API

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

### 第三方库

| 库 | 完成日期 |
|----|----------|
| diff | 2026-03-31 |
| mammoth | 2026-03-31 |
| pdf-parse | 2026-03-31 |
| xlsx | 2026-03-31 |
| markdown-it | 2026-03-31 |
