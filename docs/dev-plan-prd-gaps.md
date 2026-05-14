# DocFlow PRD 功能缺口开发计划

> 基于 PRD（企业文档管理系统-产品需求说明文档 v2.1）逐条核对代码库后生成  
> 生成日期：2025-05-14  
> 状态标记：⬜ 待开发 | 🟡 部分完成 | ✅ 已完成

---

## 一、缺口总览

| 优先级 | 缺口数 | 说明 |
|--------|--------|------|
| P0 必须 | 5 项 | 核心业务流程缺失，影响 PRD 交付 |
| P1 重要 | 6 项 | 交互/体验不完整，需补齐 |
| P2 增强 | 4 项 | 细节打磨，不阻塞主流程 |

---

## 二、P0 — 必须完成（核心业务缺失）

### P0-1 ✅ 部门管理面板（PRD §6.3.2 按部门）

**PRD 要求**：点击部门节点 ··· → "管理部门" → 打开面板，含 3 个 Tab（基本信息 / 管理员 / 下属组）  
**现状**：树节点右键菜单仅弹 toast "暂不支持"  

**开发内容**：
1. 新建 `DeptManageDrawer.vue`（抽屉式，3 Tab）
   - **基本信息 Tab**：部门名称（飞书同步只读）、负责人（飞书同步只读）、描述（可编辑）
   - **管理员 Tab**：展示部门管理员列表 + 指派/移除操作（仅部门负责人可操作）
   - **下属组 Tab**：展示该部门下所有组列表（含组名、负责人、成员数、文件数）
2. `TreeActionMenu.vue` — 部门节点新增"管理部门"菜单项
3. 后端 API：
   - `GET /api/departments/[id]` — 部门详情
   - `GET /api/departments/[id]/admins` — 部门管理员列表
   - `POST /api/departments/[id]/admins` — 指派部门管理员
   - `DELETE /api/departments/[id]/admins/[userId]` — 移除部门管理员

**涉及文件**：
- 新建：`components/DeptManageDrawer.vue`
- 修改：`components/TreeActionMenu.vue`、`pages/docs/index.vue`
- 新建：`server/api/departments/[id].get.ts`、`server/api/departments/[id]/admins.get.ts`、`server/api/departments/[id]/admins.post.ts`、`server/api/departments/[id]/admins/[userId].delete.ts`
- DB patch：`docs/patch-XXX-dept-admin.sql`（dept_admins 表或 role_assignments 扩展）

---

### P0-2 ✅ 权限继承机制 — 部门负责人/产品线负责人（PRD §6.3.2）

**PRD 要求**：
- 部门负责人自动继承到部门下所有子孙组的成员表（权限=管理员，不可删除/降权）
- 产品线负责人自动继承到所有子孙项目组的成员表（权限=管理员，不可删除/降权）
- 组成员列表中这些继承的成员需显示红色 badge（如「部门负责人（不可移除）」）

**现状**：
- 产品线创建时赋予 `pl_head` 角色权限，但**不会自动加入子组成员表**
- 部门负责人仅通过飞书同步标记，无继承逻辑

**开发内容**：
1. 后端——继承逻辑（核心）：
   - 创建子组时，查找上级部门/产品线负责人，自动插入 `doc_group_members`（权限=admin, source='inherited'）
   - 部门/产品线负责人变更时（飞书同步 or 手动指派），批量更新所有子孙组成员表
   - 成员管理 API 增加校验：`source='inherited'` 的成员不可删除/降权
2. 前端——组成员列表：
   - `GroupMemberPanel.vue` 中继承来源的成员显示红色 badge + 操作按钮 disabled
3. DB patch：`doc_group_members` 表新增 `source` 字段（'manual' | 'inherited'）

**涉及文件**：
- 修改：`server/api/groups/index.post.ts`（创建组时注入继承成员）
- 修改：`server/tasks/feishu-sync-contacts.ts`（同步负责人变更时更新继承）
- 修改：`server/api/group-members/`（校验 inherited 不可删/降权）
- 修改：`components/GroupMemberPanel.vue`（badge + disabled）
- DB patch：`docs/patch-XXX-member-source.sql`

---

### P0-3 ✅ 组负责人交接（PRD §6.3.2 交接负责人）

**PRD 要求**：树节点 ··· → "交接负责人" → 弹窗选新负责人 → 原负责人降为普通成员 → 新负责人获管理权 → 飞书通知三方  
**现状**：`TreeActionMenu` 无此入口；停用用户时有自动交接，但非主动交接

**开发内容**：
1. `TreeActionMenu.vue` — 组节点新增"交接负责人"菜单项（仅组负责人/系统管理员可见）
2. 复用 `MemberSelectorModal.vue` 选择新负责人（单选，排除当前负责人）
3. 后端 API：`POST /api/groups/[id]/transfer-leader`
   - 校验：当前用户是组负责人 or 系统管理员
   - 事务：更新负责人字段 + 原负责人降级 + 新负责人升级
   - 通知：站内 + 飞书通知三方（原负责人、新负责人、系统管理员）
   - 操作日志

**涉及文件**：
- 修改：`components/TreeActionMenu.vue`
- 修改：`pages/docs/index.vue`（处理交接事件）
- 新建：`server/api/groups/[id]/transfer-leader.post.ts`

---

### P0-4 ✅ 全屏预览器完善（PRD §6.3.4、§6.3.9、§6.4.2）

**PRD 要求**：
- 全屏预览器右侧有**版本列表侧边栏**，可切换版本预览
- 全屏预览器有**真实批注面板**（非占位），支持查看/添加批注
- 审批模式下显示"全屏对比"按钮；普通模式下显示"下载/打印"按钮

**现状**：
- 无版本侧边栏
- 批注面板为占位（"批注功能即将上线"）
- 无审批模式 vs 普通模式的按钮区分

**开发内容**：
1. `FullscreenPreviewer.vue` 右侧新增版本列表（复用 `VersionSidebar` 组件的数据逻辑）
2. 替换批注占位为真实 `AnnotationPanel`（已有组件，接入即可）
3. 增加 `mode` prop（'normal' | 'approval'），按模式切换顶部按钮组
4. 审批模式：「全屏对比」+「批注」+「关闭」
5. 普通模式：「批注」+「下载」+「打印」+「关闭」

**涉及文件**：
- 修改：`components/FullscreenPreviewer.vue`
- 可能修改：`pages/docs/file/[id].vue`（传入 mode prop）
- 可能修改：`components/ApprovalDrawer.vue`（传入 mode='approval'）

---

### P0-5 ✅ 编辑副本冲突弹窗（PRD §6.3.3 编辑副本确认弹窗）

**PRD 要求**：
- 已有他人创建的活跃编辑副本 → 弹窗文案变为"{某人} 正在编辑该文档，是否加入协同编辑？" → 二选一：「加入协同」/「取消」
- 自己已有未提交的编辑副本 → 直接打开，不重复创建

**现状**：后端 `edit-copy.post.ts` 已返回已有副本信息（`existingCopyId` + `existingCopyUserId`），但**前端无对应的冲突弹窗**

**开发内容**：
1. 调用 `edit-copy` API 后，根据返回判断：
   - 无冲突 → 正常跳转编辑器
   - `existingCopyId` 存在 + 是自己的 → 直接跳转编辑器打开该副本
   - `existingCopyId` 存在 + 是他人的 → 弹出冲突弹窗，询问是否加入协同
2. 涉及所有调用 edit-copy 的地方（共享文档列表编辑、文件详情页编辑、个人中心编辑）

**涉及文件**：
- 修改：`components/GroupFilesPanel.vue`（编辑按钮回调）
- 修改：`pages/docs/file/[id].vue`（编辑按钮回调）
- 修改：`pages/personal.vue`（编辑按钮回调）
- 可能新建：`composables/useEditCopy.ts`（统一封装冲突处理逻辑）

---

## 三、P1 — 重要（体验不完整）

### P1-1 ⬜ 飞书消息推送接入通知触发点（PRD §6.8.3）

**PRD 要求**：M1-M25 所有通知不仅写入站内通知，还要同步推送飞书交互式卡片  
**现状**：`feishuSendCard` 工具函数**已存在**且可用；`/api/integrations/feishu/notify` 也已实现。但**各业务触发点未全面接入飞书推送**

**开发内容**：
逐个业务 API 排查，在创建站内通知的同时调用飞书推送。按消息编号排查：

| 消息 | 触发 API | 飞书推送状态 |
|------|----------|-------------|
| M1 新审批 | `approvals/submit` | ⬜ 需接入 |
| M2 审批流转 | `approvals/[id]/approve` | ⬜ 需接入 |
| M3 审批通过 | `approvals/[id]/approve` | ⬜ 需接入 |
| M4 审批驳回 | `approvals/[id]/reject` | ⬜ 需接入 |
| M5 超时催办 | 定时任务 | ⬜ 需接入 |
| M6 催办达上限 | 定时任务 | ⬜ 需接入 |
| M7 审批撤回 | `approvals/[id]/withdraw` | ⬜ 需接入 |
| M8 新版本发布 | `approvals/[id]/approve`（最后一级） | ⬜ 需接入 |
| M9 文档移除 | `documents/[id]/remove` | ⬜ 需接入 |
| M10 归属人转移请求 | `documents/[id]/transfer` | ⬜ 需接入 |
| M11 转移结果 | `documents/[id]/transfer-respond` | ⬜ 需接入 |
| M12 跨组移动请求 | `documents/[id]/move` | ⬜ 需接入 |
| M13 跨组移动结果 | `documents/[id]/move-respond` | ⬜ 需接入 |
| M14 阅读权限申请 | `document-permissions/request` | ⬜ 需接入 |
| M15 编辑权限申请 | `document-permissions/request` | ⬜ 需接入 |
| M16 权限审批结果 | `document-permissions/review` | ⬜ 需接入 |
| M17 收到分享 | `share/create` | ⬜ 需接入 |
| M18 被添加为成员 | `group-members/add` | ⬜ 需接入 |
| M19 权限变更 | `group-members/update` | ⬜ 需接入 |
| M20 被移出组 | `group-members/remove` | ⬜ 需接入 |
| M21 管理员指派 | `admin/users/role` | ⬜ 需接入 |
| M22 组负责人变更 | `groups/transfer-leader` | ⬜ 需接入 |
| M23 离职交接 | `admin/users/deactivate` | ⬜ 需接入 |
| M24 审批链变更 | 审批链成员被移除时 | ⬜ 需接入 |
| M25 引用失效 | `cleanupDocumentReferences` | ⬜ 需接入 |

> 建议封装 `server/utils/notify.ts` 统一入口，同时写站内通知 + 推飞书

---

### P1-2 ✅ 10 分钟自动保存快照（PRD §6.3.6）

**PRD 要求**：距离上次保存满 10 分钟且文档有变更 → 自动创建快照；重试 3 次失败 → 顶栏警示  
**现状**：仅有 2 秒防抖自动保存（保存到 Hocuspocus），**无 10 分钟快照定时器**

**开发内容**：
1. `composables/useDocEditor.ts` 或编辑器页面增加 `setInterval(600000)` 定时器
2. 检查文档是否有变更（dirty flag）
3. 有变更 → 调用快照 API 创建自动保存快照（标签="自动保存"）
4. 失败重试 3 次，仍失败 → 顶栏显示 `⚠ 自动保存失败，请检查网络`
5. 离开页面时清除定时器

**涉及文件**：
- 修改：`pages/docs/editor/[id].vue` 或 `composables/useDocEditor.ts`

---

### P1-3 ✅ 共享文档列表行"编辑"入口（PRD §6.3.3 更多菜单）

**PRD 要求**：文件行 ··· 更多 → 「编辑」→ 弹出编辑副本确认弹窗 → 进入编辑器  
**现状**：`GroupFilesPanel.vue` 行操作下拉无"编辑"项

**开发内容**：
1. `GroupFilesPanel.vue` 行操作菜单新增"编辑"项（显示条件：当前用户对该文件有可编辑权限）
2. 点击后触发编辑副本流程（复用 P0-5 的 `useEditCopy`）

**涉及文件**：
- 修改：`components/GroupFilesPanel.vue`

---

### P1-4 ⬜ 飞书离职 Webhook 自动触发交接（PRD §2.2 触点5）

**PRD 要求**：飞书人事事件（员工离职）→ Webhook 回调 → 自动触发文档交接流程  
**现状**：离职交接仅通过管理员手动"停用用户"触发，无 Webhook 入口

**开发内容**：
1. 新建 `server/api/integrations/feishu/webhook/employee.post.ts`
2. 接收飞书人事事件 Webhook（事件类型：`contact.user.leave`）
3. 校验签名后，自动调用现有停用逻辑（复用 `deactivate.put.ts` 的核心交接代码）
4. 鉴权白名单需添加此路径

**涉及文件**：
- 新建：`server/api/integrations/feishu/webhook/employee.post.ts`
- 修改：`server/middleware/auth.ts`（白名单）
- 可能抽取：`server/utils/user-deactivation.ts`（从 deactivate.put.ts 抽离复用逻辑）

---

### P1-5 ⬜ 飞书 Bot 文档归档入口（PRD §2.2 触点3）

**PRD 要求**：飞书 Bot + 粘贴飞书文档链接 → 自动归档到 DocFlow  
**现状**：仅有 DocFlow 内的"导入飞书文档"弹窗，**飞书 Bot 入口未做**

**开发内容**：
1. 新建 `server/api/integrations/feishu/webhook/bot-message.post.ts`
2. 接收飞书机器人消息事件，解析消息中的飞书文档链接
3. 自动调用飞书 API 获取文档内容 → 转 MD → 创建 DocFlow 草稿
4. 通过 Bot 回复用户：「文档已归档到个人中心，请在 DocFlow 中提交发布」
5. 鉴权白名单需添加此路径

**涉及文件**：
- 新建：`server/api/integrations/feishu/webhook/bot-message.post.ts`
- 修改：`server/middleware/auth.ts`（白名单）

---

### P1-6 ✅ 批注冻结规则（PRD §6.3.9(5)）

**PRD 要求**：
- 新版本发布后，旧版本批注冻结（不可新增/回复/解决/删除）
- 冻结视觉：黄色横幅 + 灰度60% + 操作按钮隐藏
- 创建编辑副本时弹窗提示"当前版本有 N 条未解决批注"

**现状**：`AnnotationPanel` 已有 `frozen` prop 和冻结提示条，但需确认**后端是否在发布新版本时自动冻结旧批注**，以及**编辑副本弹窗是否显示未解决批注计数**

**开发内容**：
1. 确认后端发布新版本时标记旧版本批注为 frozen
2. 编辑副本确认弹窗增加"当前版本有 N 条未解决批注"提示
3. 确认 AnnotationPanel 的 frozen 逻辑链路是否完整

**涉及文件**：
- 可能修改：`server/api/approvals/[id]/approve.post.ts`（发布时冻结旧批注）
- 可能修改：`server/api/documents/[id]/edit-copy.post.ts`（返回未解决批注数）
- 修改：调用 edit-copy 的前端弹窗组件

---

## 四、P2 — 增强（细节打磨）

### P2-1 ⬜ 个人中心操作矩阵完善（PRD §6.5.2）

**现状**：个人中心基本功能完整，但需逐行对比 PRD 操作矩阵，确认所有 状态×来源 组合的按钮是否完全匹配。

**待确认项**：
- 编辑中 + 分享给我的（可编辑）→ 是否有"编辑/分享/下载/提交发布"
- 已发布 + 分享给我的（可阅读）→ 是否显示"申请编辑权限"替代"编辑"
- 已发布 + 共享文档（收藏）→ 是否仅显示"查看/分享/下载/取消收藏"

---

### P2-2 ⬜ 审批超时催办定时任务（PRD §6.4.2）

**PRD 要求**：审批超过 24 小时 → 系统自动给审批人发飞书消息催办，每 24 小时一次  
**现状**：需确认 `server/tasks/` 下是否有催办定时任务

**开发内容**：
1. 新建 `server/tasks/approval-reminder.ts` 定时任务
2. 查询超 24 小时未处理的审批 → 发站内通知 M5 + 飞书消息
3. 催办次数达上限 → 通知提交人 M6

---

### P2-3 ⬜ 版本对比 — 变更统计（PRD §6.4.2 审批抽屉）

**PRD 要求**：审批抽屉中显示变更摘要 — 版本对比标签 + badge（+新增N处 / -删除N处 / ~修改N处） + 变更明细列表  
**现状**：`ApprovalDrawer.vue` 已有版本对比入口，但需确认变更统计是否完整

---

### P2-4 ⬜ 审批链 UI — 会签模式（PRD §6.4.2）

**PRD 要求**：审批链支持"依次审批"和"会签审批"两种模式，依次审批用箭头连接，会签并列显示  
**现状**：需确认 `ApprovalChain.vue` 是否已支持会签模式

---

## 五、已验证完成的功能 ✅

以下功能经代码验证已完成，无需额外开发：

| PRD 节 | 功能 | 验证结果 |
|--------|------|----------|
| §6.3.1 | 文档导航树 | ✅ DocNavTree + DocNavTreeNode 完整 |
| §6.3.2 | 创建组 / 编辑组 / 删除组 | ✅ GroupFormModal + API 完整 |
| §6.3.2 | 产品线管理 | ✅ ProductLineManageDrawer 完整 |
| §6.3.2 | 搜索 | ✅ GlobalSearchBox 完整（MDN 风格） |
| §6.3.3 | 文件列表（上传/下载/置顶/收藏/跨组移动/移除/权限设置） | ✅ GroupFilesPanel 完整 |
| §6.3.3 | 批量操作 | ✅ BulkActionBar 完整 |
| §6.3.3 | 导入飞书文档 | ✅ FeishuImportModal 完整 |
| §6.3.4 | 文件详情页 | ✅ pages/docs/file/[id].vue 完整 |
| §6.3.4 | 版本对比模式 | ✅ VersionCompareViewer 完整 |
| §6.3.4 | 版本记录侧边栏 | ✅ VersionSidebar 完整 |
| §6.3.5 | 在线编辑器 | ✅ MilkdownEditor + Hocuspocus 完整 |
| §6.3.5 | 编辑器提交发布 | ✅ 编辑器顶栏有"提交发布"按钮 |
| §6.3.6 | 快照抽屉（创建/预览/还原） | ✅ SnapshotDrawer + 预览横幅完整 |
| §6.3.7 | 多人协同编辑 | ✅ Yjs + Hocuspocus 完整 |
| §6.3.8 | 链接分享 | ✅ ShareLinkModal + API 完整 |
| §6.3.8 | 申请编辑权限 | ✅ PermissionRequestReviewModal 完整 |
| §6.3.9 | 选字批注（编辑器 + 文件详情页） | ✅ AnnotationPanel 已接入 |
| §6.3.10 | 归属人转移 | ✅ OwnershipTransferModal + API 完整 |
| §6.4 | 审批中心（3 Tab + 抽屉 + 通过/驳回/撤回） | ✅ 完整 |
| §6.5 | 个人中心（5 Tab + 操作矩阵） | ✅ 基本完整 |
| §6.6 | 回收站 | ✅ 完整 |
| §6.7 | 操作日志 | ✅ 完整 |
| §6.8 | 通知中心（站内通知 + 铃铛 + TAB 分类） | ✅ 站内通知完整 |
| §6.9 | 系统管理 | ✅ 完整 |
| §6.10 | 文档引用（添加/取消/详情/自动失效/M25通知） | ✅ 完整 |
| 飞书 SSO | OAuth 登录 | ✅ 完整 |
| 飞书选人器 | MemberSelectorModal | ✅ 完整 |
| 飞书同步 | 通讯录同步 | ✅ 完整 |

---

## 六、建议开发顺序

```
Phase 1 — 核心业务补齐（P0）
  ├── P0-5 编辑副本冲突弹窗（最小改动，立即可做）
  ├── P0-3 组负责人交接（独立功能，不依赖其他）
  ├── P0-4 全屏预览器完善（版本侧栏 + 批注 + 审批模式）
  ├── P0-1 部门管理面板
  └── P0-2 权限继承机制（最复杂，依赖 P0-1）

Phase 2 — 体验增强（P1）
  ├── P1-3 共享文档列表行"编辑"入口（最小改动）
  ├── P1-6 批注冻结规则验证 & 补齐
  ├── P1-2 10 分钟自动保存快照
  ├── P1-1 飞书消息推送接入（工作量最大，逐 API 接入）
  ├── P1-4 飞书离职 Webhook
  └── P1-5 飞书 Bot 文档归档

Phase 3 — 细节打磨（P2）
  ├── P2-1 个人中心操作矩阵
  ├── P2-2 审批超时催办定时任务
  ├── P2-3 版本对比变更统计
  └── P2-4 审批链会签模式
```

---

## 七、不做清单（PRD 明确声明）

以下功能 PRD 明确标注"不做"，无需开发：

- ❌ 密码保护链接
- ❌ 链接有效期 / 过期时间
- ❌ 链接访问次数限制
- ❌ 外部用户分享
- ❌ 审批批量通过/驳回
- ❌ 审批流自动跳过（审批人离职时）
- ❌ 多选转移归属人
- ❌ 转移后重新审批
- ❌ 转移过程中文档锁定
- ❌ 转移撤销
