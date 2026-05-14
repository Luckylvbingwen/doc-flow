# DocFlow PRD 功能缺口开发计划

> 基于 PRD（企业文档管理系统-产品需求说明文档 v2.1）逐条核对代码库后生成  
> 生成日期：2025-05-14  
> 状态标记：⬜ 待开发 | 🟡 部分完成 | ✅ 已完成

---

## 一、缺口总览

| 优先级 | 缺口数 | 说明 |
|--------|--------|------|
| P0 必须 | 5 项 ✅ 全部完成 | 核心业务流程缺失，影响 PRD 交付 |
| P1 重要 | 6 项 ✅ 全部完成 | 交互/体验不完整，需补齐 |
| P2 增强 | 4 项 ✅ 全部完成 | 细节打磨，不阻塞主流程 |

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

### P1-1 ✅ 飞书消息推送接入通知触发点（PRD §6.8.3）

**PRD 要求**：M1-M25 所有通知不仅写入站内通知，还要同步推送飞书交互式卡片  
**现状**：✅ 已在 `server/utils/notify.ts` 统一入口中集成飞书推送。`createNotification` 和 `createNotifications` 写入站内通知后自动推送飞书交互卡片，所有 M1-M25 触发点无需逐个修改。

**实现方案**：
- 在 `notify.ts` 中增加 `pushFeishuCard` 内部辅助函数，查询用户 `feishu_open_id` 后调用 `feishuSendCard`
- 飞书卡片按通知分类（审批/系统/成员变更）使用不同 header 颜色
- 推送失败仅记录日志，不阻塞站内通知主流程
- 批量通知场景通过 `batchGetFeishuOpenIds` 一次性查询，避免 N+1

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

### P1-4 ✅ 飞书离职 Webhook 自动触发交接（PRD §2.2 触点5）

**PRD 要求**：飞书人事事件（员工离职）→ Webhook 回调 → 自动触发文档交接流程  
**现状**：✅ 已实现

**实现方案**：
1. 抽取 `server/utils/user-deactivation.ts` — 用户停用核心逻辑（停用+组交接+审批链清理+通知），供 API 和 Webhook 共用
2. 重构 `server/api/admin/users/[id]/deactivate.put.ts` — 改为调用共享工具
3. 新建 `server/api/integrations/feishu/webhook/employee.post.ts` — 飞书人事事件 Webhook
   - 支持 url_verification 挑战验证
   - 处理 `contact.user.updated_v3` 事件（检测 `is_resigned=true`）
   - 通过 feishu_open_id 匹配 DocFlow 用户
   - 调用 `deactivateUser(source='feishu_webhook')` 自动停用并交接
   - event_id 去重防止重复处理
4. `server/middleware/auth.ts` — 白名单新增 `/api/integrations/feishu/webhook/employee`
5. `nuxt.config.ts` + `.env.example` — 新增 `FEISHU_VERIFICATION_TOKEN` / `FEISHU_ENCRYPT_KEY` 配置

---

### P1-5 ✅ 飞书 Bot 文档归档入口（PRD §2.2 触点3）

**PRD 要求**：飞书 Bot + 粘贴飞书文档链接 → 自动归档到 DocFlow  
**现状**：✅ 已实现

**实现方案**：
1. 新建 `server/api/integrations/feishu/webhook/bot-message.post.ts` — 飞书机器人消息 Webhook
   - 支持 url_verification 挑战验证
   - 处理 `im.message.receive_v1` 事件（消息接收）
   - 从文本消息中提取飞书文档 URL
   - 调飞书 API 获取文档标题 + raw_content
   - 写入 MinIO 存储 → 创建个人草稿文档
   - 通过 Bot 回复用户：「文档已归档到个人中心」
2. `server/middleware/auth.ts` — 白名单新增 `/api/integrations/feishu/webhook/bot-message`

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

### P2-1 ✅ 个人中心操作矩阵完善（PRD §6.5.2）

**现状**：✅ 已按 PRD 操作矩阵逐行校准。

**实现内容**：
1. 重写 `utils/personal-matrix.ts` — 按 PRD §6.5.2 表格逐行实现 9 种 状态×来源 组合
2. 新增 `unfavorite`（取消收藏）动作，已发布+收藏来源显示
3. 编辑按钮扩展覆盖：编辑中+分享（可编辑）、已发布+我创建的、已发布+分享（可编辑）
4. 已发布编辑走编辑副本流程（含冲突弹窗）
5. 下载/分享按钮全状态可用（放入更多菜单）
6. `profile.vue` 操作区拆分为直接按钮 + ··· 更多下拉菜单
7. 单元测试全部更新（16 个用例通过）

---

### P2-2 ✅ 审批超时催办定时任务（PRD §6.4.2）

**现状**：✅ 已实现，代码位于 `server/tasks/approval/remind-timeout.ts`

**已实现内容**：
1. 定时任务 `approval:remind-timeout` 已注册在 `nuxt.config.ts`，按整点触发
2. 扫描超 24 小时未处理的审批节点 → 发 M5 站内通知 + 飞书催办
3. 催办次数达上限（`remind_max_count`）→ 发 M6 通知提交人
4. 乐观锁防并发重复催办

---

### P2-3 ✅ 版本对比 — 变更统计（PRD §6.4.2 审批抽屉）

**现状**：✅ 已完善。

**实现内容**：
1. `ApprovalDrawer.vue` 变更明细列表增加 5 条截断 + 展开/收起切换（PRD 要求「默认展示5项」）
2. 审批中心 `@compare` 事件接通 → 跳转文件详情页全屏对比
3. 变更统计 badge（+新增/~修改/-删除）+ 大小变化已完整显示

---

### P2-4 ✅ 审批链 UI — 会签模式（PRD §6.4.2）

**现状**：✅ 已实现全链路会签支持。

**实现内容**：
1. `approval-router.ts` — 返回模板 `mode`（1=依次/2=会签），不再硬编码
2. `document-upload.ts` — 创建审批实例时写入真实 mode，会签模式 current_node_order=null
3. `approve.post.ts` — 会签模式：审批人通过后检查是否全部通过，全部通过→完成；不推进 node_order
4. `reject.post.ts` — 会签模式：直接按 approver_user_id 找 pending 节点，任一驳回→整体驳回
5. `approvals/index.get.ts` — 待审批列表：会签模式所有 pending 节点都算"当前"（去除 current_node_order 约束）
6. `approvals/[id]/index.get.ts` — 审批详情返回 `mode` 字段
7. `ApprovalChain.vue` — 新增 `mode` prop：依次=箭头串联，会签=并列显示（「同时审批」标签 + 并列卡片）
8. `ApprovalDrawer.vue` — 传递 mode 到审批链组件
9. `approvals.vue` — 构建详情时：会签模式所有 pending 节点标为 current
10. `_approval.scss` — 新增会签并列布局样式

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
Phase 1 — 核心业务补齐（P0）✅ 全部完成
  ├── P0-5 编辑副本冲突弹窗 ✅
  ├── P0-3 组负责人交接 ✅
  ├── P0-4 全屏预览器完善 ✅
  ├── P0-1 部门管理面板 ✅
  └── P0-2 权限继承机制 ✅

Phase 2 — 体验增强（P1）✅ 全部完成
  ├── P1-3 共享文档列表行"编辑"入口 ✅
  ├── P1-6 批注冻结规则验证 & 补齐 ✅
  ├── P1-2 10 分钟自动保存快照 ✅
  ├── P1-1 飞书消息推送接入 ✅ 2026-05-14
  ├── P1-4 飞书离职 Webhook ✅ 2026-05-14
  └── P1-5 飞书 Bot 文档归档 ✅ 2026-05-14

Phase 3 — 细节打磨（P2）✅ 全部完成
  ├── P2-1 个人中心操作矩阵 ✅ 2026-05-14
  ├── P2-2 审批超时催办定时任务 ✅（已有实现）
  ├── P2-3 版本对比变更统计 ✅ 2026-05-14
  └── P2-4 审批链会签模式 ✅ 2026-05-14
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
