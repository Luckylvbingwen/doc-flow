# 组审批流配置 — 设计文档

> 日期：2026-04-17
> 范围：A 阶段 — 组设置弹窗「审批流配置」Tab 的模板 CRUD（开关 / 模式 / 审批人列表）
> 不在本次范围：审批实例运行、超时催办、M2/M24 通知、审批人离职继承

---

## 1. 功能概述

为每个文档组提供审批模板的配置能力，替换当前 `GroupSettingsModal` 第一个 Tab 的 `<el-empty>` 占位。组管理员可开关"上传需审批"、选择审批模式（依次 / 会签）、管理有序的审批人列表并预览审批链路。

**PRD 对应**：§143（权限矩阵-审批配置）、§184（组创建流程）、§243-249（公司层组设置-审批流配置）、§317（部门组沿用）、§393（产品线组沿用）。

**原型参考**：`docs/prototype-v21.0.html:2478-2626` — UI 形态；`openMemberSelector` 被审批人选择复用。

---

## 2. 范围边界

| 事项 | 本次（A 阶段） | 后续 |
|---|---|---|
| 模板 CRUD（开关 / 模式 / 审批人） | ✅ | — |
| UI：开关、模式卡、审批人行、链路预览、保存 | ✅ | — |
| 组创建时初始化默认模板 | ✅ | — |
| 存量老组 GET 兜底默认 | ✅ | — |
| 上传文件时按模板起 `doc_approval_instances` | ❌ | B 阶段 |
| 审批通过 / 驳回 / 流转 | ❌ | B 阶段（审批中心抽屉） |
| 超时催办（24h） | ❌ | C 阶段 |
| M2 / M24 审批流转 / 审批链变更通知 | ❌ | 通知模块 |
| 审批人继承机制（部门/产品线负责人） | ❌ | 跟组成员 B 阶段合并讨论 |

---

## 3. 数据模型

### 3.1 字段权威来源

| 字段 | 作用 | 策略 |
|---|---|---|
| `doc_groups.approval_enabled` | **总开关**（0/1） | **单一信息源**。前端 / 后端判断"此组是否走审批"统一读此字段 |
| `doc_approval_templates.enabled` | 冗余字段 | **本阶段不用**。默认为 1；注释标注"以 `doc_groups.approval_enabled` 为准"；为后续"多模板 / 草稿模板"等扩展留路子 |
| `doc_approval_templates.timeout_hours` | 超时时长（小时） | **本阶段不暴露 UI**。存默认值 24；B 阶段运行时催办启用后再暴露 |
| `doc_approval_templates.mode` | 审批模式 | 1=依次审批；2=会签审批 |
| `doc_approval_template_nodes.order_no` | 审批人顺序 | 1..N；同模板唯一；依次模式按序；会签模式只决定展示顺序 |

### 3.2 数据生命周期

```
组创建 (POST /api/groups)
  └─ 同事务追加:
       doc_approval_templates            (group_id, mode=1, timeout_hours=24)
       doc_approval_template_nodes       (template_id, order_no=1, approver=组负责人)
       doc_groups.approval_enabled = 1

组管理员配置审批流 (PUT /api/groups/:id/approval-template)
  └─ 事务内:
       upsert doc_approval_templates     (mode 可改)
       delete doc_approval_template_nodes (WHERE template_id = ?)
       insert doc_approval_template_nodes (批量按传入顺序)
       update doc_groups.approval_enabled

存量老组（无模板记录）
  └─ GET: 兜底构造 { enabled, mode=1, approvers=[组负责人] } — 不写库
  └─ PUT: 首次保存时正常 upsert 建真实记录
```

### 3.3 数据库改动评估

经评估，已有 `doc_approval_templates` + `doc_approval_template_nodes` 两表字段完全覆盖本设计所需（含审批人顺序 `order_no`、模式 `mode`、超时 `timeout_hours`）。**本次无需改动数据库**，但数据库非硬冻结：后续若 B/C 阶段（审批实例运行、催办、继承等）发现字段不足，可在对应迭代追加。

---

## 4. 后端 API

### 4.1 GET /api/groups/:id/approval-template

**用途**：读取组的审批配置。

**权限**：`requireMemberPermission`（组负责人 / scope 管理角色 / 组内管理员 role=1），对齐 PRD §143。

**响应 data**：
```json
{
  "approvalEnabled": 1,
  "mode": 1,
  "approvers": [
    { "userId": 10002, "name": "张三", "avatar": "https://...", "isOwner": true },
    { "userId": 10005, "name": "李四", "avatar": null, "isOwner": false }
  ]
}
```

**字段说明**：
- `approvalEnabled`：取自 `doc_groups.approval_enabled`（0/1）
- `mode`：1 依次 / 2 会签。模板不存在时默认 1
- `approvers`：按 `order_no ASC` 返回
- `isOwner`：该审批人是否为当前组负责人（前端用于加 "组负责人" tag）

**兜底逻辑（模板不存在时）**：
- 查 `doc_approval_templates WHERE group_id=? AND deleted_at IS NULL`
- 若不存在：构造 `{ approvalEnabled: group.approval_enabled, mode: 1, approvers: [组负责人] }`
- **不写库**（避免 GET 副作用，并发安全）

**错误码**：`INVALID_PARAMS`, `GROUP_NOT_FOUND`, `PERMISSION_DENIED`

### 4.2 PUT /api/groups/:id/approval-template

**用途**：整包保存审批配置。

**权限**：`requireMemberPermission`。

**请求 body**：
```json
{
  "approvalEnabled": 1,
  "mode": 1,
  "approverUserIds": [10002, 10005, 10008]
}
```

**Zod 校验**：
- `approvalEnabled`: `z.union([z.literal(0), z.literal(1)])`
- `mode`: `z.union([z.literal(1), z.literal(2)])`
- `approverUserIds`: `z.array(z.number().int().positive()).max(20)`
  - `.refine()`：去重后长度相等（不允许重复 userId）
  - `.refine()`：`approvalEnabled=1` 时长度 ≥ 1

**服务端事务**：
1. 校验 `groupId` 合法、`group` 存在 + `deleted_at IS NULL`
2. 权限校验
3. 若 `approvalEnabled=1`：校验所有 `approverUserIds` 都是活跃用户（`doc_users.status=1 AND deleted_at IS NULL`），有缺失即 400
4. 事务内：
   - `upsert doc_approval_templates(group_id)` → 设置 mode、timeout_hours=24
   - `DELETE FROM doc_approval_template_nodes WHERE template_id = ?`
   - `INSERT INTO doc_approval_template_nodes(template_id, order_no, approver_user_id)` 批量按数组顺序，order_no 从 1 起
   - `UPDATE doc_groups SET approval_enabled = ? WHERE id = ?`

**错误码**：
| code | HTTP | 场景 |
|---|---|---|
| `INVALID_PARAMS` | 400 | Zod 失败：字段格式、超过 20 人、重复 userId |
| `APPROVAL_APPROVERS_REQUIRED` | 400 | `approvalEnabled=1` 但 `approverUserIds=[]` |
| `APPROVAL_INVALID_APPROVER` | 400 | 有 userId 指向的用户不存在或已停用 |
| `GROUP_NOT_FOUND` | 404 | 组不存在 |
| `PERMISSION_DENIED` | 403 | 无审批配置权限 |

### 4.3 组创建接口改造

**文件**：`server/api/groups/index.post.ts`

在现有的 `prisma.$transaction([...])` 数组里追加：
- `doc_approval_templates.create`：`{ group_id, mode: 1, timeout_hours: 24, enabled: 1, created_by }`
- `doc_approval_template_nodes.create`：`{ template_id, order_no: 1, approver_user_id: <组负责人 = userId> }`

同时 `doc_groups.create` 的 data 显式传 `approval_enabled: 1`（保持幂等，不依赖数据库默认值）。

---

## 5. 错误码新增

在 `server/constants/error-codes.ts` 的「组成员」区块后追加：

```typescript
// ─── 审批模板 ───
/** 开启审批时审批人不能为空 (400) */
export const APPROVAL_APPROVERS_REQUIRED = 'APPROVAL_APPROVERS_REQUIRED'
/** 审批人用户不存在或已停用 (400) */
export const APPROVAL_INVALID_APPROVER = 'APPROVAL_INVALID_APPROVER'
```

---

## 6. 前端

### 6.1 类型 — `types/approval-template.ts`

```typescript
export type { SaveApprovalTemplateBody } from '~/server/schemas/approval-template'

/** 审批模式映射 */
export const APPROVAL_MODE_MAP = {
  1: '依次审批',
  2: '会签审批',
} as const

export interface ApprovalApprover {
  userId: number
  name: string
  avatar: string | null
  isOwner: boolean
}

export interface ApprovalTemplate {
  approvalEnabled: 0 | 1
  mode: 1 | 2
  approvers: ApprovalApprover[]
}
```

### 6.2 API 封装 — `api/approval-template.ts`

```typescript
apiGetApprovalTemplate(groupId: number)
  → useAuthFetch<ApiResult<ApprovalTemplate>>(`/api/groups/${groupId}/approval-template`)

apiSaveApprovalTemplate(groupId: number, body: SaveApprovalTemplateBody)
  → useAuthFetch<ApiResult>(`/api/groups/${groupId}/approval-template`, { method: 'PUT', body })
```

### 6.3 组件 — `components/GroupApprovalPanel.vue`

作为 `GroupSettingsModal` 第一个 Tab 的内容（替换现有 `<el-empty>` 占位）。

**Props**：
- `groupId: number`

**Emits**：
- `success` — 保存成功时派发，供父级按需刷新

**布局**（自上而下）：

```
① 总开关卡片
   ┌─────────────────────────────────────────────────┐
   │  上传需审批   [●━━ 开]                           │
   │  已开启：普通成员上传文件需经审批人审批后才能发布  │
   └─────────────────────────────────────────────────┘

② 开关=关时，下方只显示一个大空态
   （el-empty "审批已关闭，所有上传文件将直接发布"）

③ 开关=开时，展示 ④⑤⑥

④ 审批模式卡片（两个 radio-card 并排，选中态边框=主色）
   ┌───────────────┐   ┌───────────────┐
   │ → 依次审批     │   │ ⇆ 会签审批     │
   │ 按顺序逐个…   │   │ 所有审批人同时…│
   │ A → B → C      │   │ A / B / C → … │
   └───────────────┘   └───────────────┘

⑤ 审批人列表卡片
   ┌──────────────────────────────────────────────────┐
   │ 审批人（审批人可以是系统中任何用户）  [+ 添加审批人]│
   ├──────────────────────────────────────────────────┤
   │ ① [头像] 张三 [组负责人]             ▲ ▼ (× 隐藏) │
   │ ② [头像] 李四                        ▲ ▼  ×      │
   │ ③ [头像] 王五                        ▲ ▼  ×      │
   └──────────────────────────────────────────────────┘
   （仅 1 人时 × 隐藏；hover 上移/下移在首/末时禁用）

⑥ 审批链预览卡片（随 mode 切换）
   mode=1：提交人上传 → 张三 → 李四 → 王五 → 发布（横向 chain）
   mode=2：提交人上传 → [张三 / 李四 / 王五 同时审批] → 全部通过 → 发布

⑦ 底部操作区（sticky 或 tab 底部）
   [取消]  [保存]   ← 仅 dirty && 校验通过 才 enabled
```

**状态管理**：
```typescript
const form = ref<ApprovalTemplate>({ approvalEnabled: 1, mode: 1, approvers: [] })
const original = ref<ApprovalTemplate | null>(null)  // load 时快照
const loading = ref(false)
const saving = ref(false)

const isDirty = computed(() => !isEqual(form.value, original.value))
const isValid = computed(() => {
  if (form.value.approvalEnabled === 0) return true
  return form.value.approvers.length >= 1
})
const canSave = computed(() => isDirty.value && isValid.value && !saving.value)
```

**离开前确认**：
- `GroupSettingsModal` 切 Tab 或关闭弹窗时，检查面板的 `isDirty`
- dirty 时 `msgConfirm("有未保存的修改，确认放弃？")`，取消则阻止
- 实现方式：面板通过 `defineExpose({ isDirty, reset })` 暴露给父级

**添加审批人**：
- 点"+ 添加审批人" → 打开 `MemberSelectorModal`
- **不传** `groupId`（审批人是"系统中任意用户"，跟组成员无关；传 `groupId` 会按组成员标记 joined，语义错误）
- 传 `excludeUserIds = form.approvers.map(a => a.userId)` 把已选人灰显
- 传新增 prop `showRoleSelector: false` 隐藏 footer 的权限下拉（审批人不涉及 `role`）
- 确认回调签名在 `showRoleSelector=false` 下退化为 `emit('confirm', users)`（不带 role）
- 追加到 `form.approvers`，超过 20 人时"+ 添加审批人"按钮 disabled，tooltip"最多 20 位审批人"

**上移 / 下移**：
- 本地 `form.approvers` 数组 swap，数组下标 = 审批人显示顺序
- 保存时按数组顺序传 `approverUserIds`，服务端按数组顺序重建 `order_no`（从 1 起递增）
- 下次打开 GET 接口按 `ORDER BY order_no ASC` 返回，顺序原样回显
- 第 1 行上移禁用，最后 1 行下移禁用

**数据持久化心智模型**：本 Tab 所有字段（开关 / 模式 / 审批人增删 / 顺序）一律"本地修改 → 保存按钮 → 整包 PUT"。dirty 时切 Tab / 关弹窗 触发 `msgConfirm`；浏览器硬刷新由用户自担（不用 `beforeunload` 拦截，项目统一不用浏览器原生弹窗）。

**移除**：
- `approvers.length > 1` 时才渲染 × 按钮
- 即使组负责人行也可移除（PRD 无硬约束）

**保存**：
- 调 `apiSaveApprovalTemplate`
- 成功：`msgSuccess(res.message || '保存成功')` + `original = clone(form)` + `emit('success')`
- 失败：`msgError(res.message)`；对于 `APPROVAL_INVALID_APPROVER`（审批人已停用）额外提示并重新加载

### 6.4 `GroupSettingsModal` 改动

第一个 Tab：
```diff
- <el-tab-pane label="审批流配置" name="approval">
-   <div class="gs-placeholder"><el-empty description="审批流配置即将上线" :image-size="100" /></div>
- </el-tab-pane>
+ <el-tab-pane label="审批流配置" name="approval">
+   <GroupApprovalPanel ref="approvalPanelRef" :group-id="groupId" @success="emit('success')" />
+ </el-tab-pane>
```

Tab 切换 / 关闭弹窗时的 dirty 拦截：
```typescript
async function beforeLeaveApprovalTab(): Promise<boolean> {
  if (approvalPanelRef.value?.isDirty) {
    return await msgConfirm('有未保存的修改，确认放弃？')
  }
  return true
}

// el-tabs 用 :before-leave 属性挂 beforeLeaveApprovalTab
// 关弹窗前也走一遍
```

初始 Tab 调整为"审批流配置"（`activeTab = 'approval'` 替换当前的 `'members'`），对齐原型 `prototype-v21.0.html:2447-2449` 的默认 Tab 顺序（审批 → 成员 → 基本），也符合 PRD §243 在组设置章节里把审批流配置放在首位的次序。

---

## 7. 样式

所有新增样式追加到 `assets/styles/components/_modals.scss` 末尾：

```scss
/* ── 审批流配置面板 ── */
.ap-switch-card { /* 开关卡片 */ }
.ap-empty { /* 关闭态空态 */ }
.ap-mode-card { /* 模式卡片 */ }
.ap-mode-card--selected { /* 选中态边框主色 */ }
.ap-approver-row { /* 审批人行：序号 + 头像 + 姓名 + 按钮组 */ }
.ap-approver-actions { /* ▲▼× 按钮组 */ }
.ap-chain { /* 审批链预览容器 */ }
.ap-chain__node { /* 链上节点 */ }
.ap-chain__arrow { /* → 箭头 */ }
.ap-footer { /* sticky 底部操作区 */ }
```

---

## 8. 测试

对齐项目现有测试策略（纯函数单测为主，不做 handler mock 集成测试）：

**`tests/unit/schemas/approval-template.test.ts`**（12 条用例）：
| # | 用例 | 期望 |
|---|---|---|
| 1 | 合法开启配置 `{enabled:1, mode:1, approvers:[1,2,3]}` | pass |
| 2 | 合法关闭配置 `{enabled:0, mode:1, approvers:[]}` | pass |
| 3 | 会签模式 `{mode:2}` | pass |
| 4 | 单人审批 `{enabled:1, mode:1, approvers:[1]}` | pass |
| 5 | 拒绝 `enabled=1` 且 `approvers=[]` | fail |
| 6 | 拒绝 `mode=3`（非法） | fail |
| 7 | 拒绝 `approvers` 超过 20 | fail |
| 8 | 拒绝 `approvers` 有重复 userId | fail |
| 9 | 拒绝 `approvers` 包含负数 | fail |
| 10 | 拒绝 `approvers` 包含小数 | fail |
| 11 | 拒绝 `enabled=2`（非 0/1） | fail |
| 12 | 拒绝缺字段 / 未知字段 | fail |

**不做的测试**（与现有策略一致）：
- API handler 集成（无 prisma mock 基础设施）
- Vue 组件 snapshot

**手动冒烟清单**（实现计划 plan 里的最后一步 Task）：
1. 新建组 → 打开设置 → 审批流 Tab 默认显示：开启 + 依次 + 组负责人 1 人
2. 关开关 → 显示空态 "审批已关闭"
3. 开开关 → 数据恢复
4. 切会签 → 链路预览从横向链变为并列同时审批
5. 添加审批人 → 选择器排除已加入 → 确认后追加
6. 审批人仅 1 人时 × 隐藏
7. 上移 / 下移 → 第一行 ▲ 禁用，末行 ▼ 禁用
8. 移除组负责人（可以操作）→ 保存后刷新，组负责人不再在列表
9. dirty 时切 Tab / 关弹窗 → 二次确认
10. 非管理员进入接口（curl 或切账号）→ 403

---

## 9. 文件清单

### 新增（8 个）

| 文件 | 说明 |
|---|---|
| `server/schemas/approval-template.ts` | Zod schema + 类型导出 |
| `server/types/approval-template.ts` | DB 行类型 |
| `server/api/groups/[id]/approval-template.get.ts` | 读接口 |
| `server/api/groups/[id]/approval-template.put.ts` | 整包保存接口 |
| `types/approval-template.ts` | 前端类型 + `APPROVAL_MODE_MAP` |
| `api/approval-template.ts` | 前端 API 封装 |
| `components/GroupApprovalPanel.vue` | 审批流配置面板 |
| `tests/unit/schemas/approval-template.test.ts` | 12 条 schema 单测 |

### 修改（5 个）

| 文件 | 修改 |
|---|---|
| `server/api/groups/index.post.ts` | 同事务追加 template + template_node + `approval_enabled=1` |
| `server/constants/error-codes.ts` | +2 错误码 |
| `components/GroupSettingsModal.vue` | 第一 Tab 用 `<GroupApprovalPanel>` 替换 `<el-empty>`；加 dirty 拦截；默认 Tab 改 `'approval'` |
| `components/MemberSelectorModal.vue` | 新增 `showRoleSelector: boolean = true` prop；`showRoleSelector=false` 时 footer 隐藏权限下拉，confirm emit 不带 role |
| `assets/styles/components/_modals.scss` | 追加 `.ap-*` 样式 |

### 文档

| 文件 | 修改 |
|---|---|
| `docs/api-auth-design.md` | 接口总览表 + 详情追加 2 个接口 |
| `docs/dev-progress.md` | 落地完成后追加 2026-04-17 的"审批流配置 Tab"条目 |
| `docs/feature-gap-checklist.md` | "组设置 — 审批流配置 tab" 移至已完成 |

---

## 10. 不在本阶段范围

- 审批实例运行（`doc_approval_instances` / `doc_approval_instance_nodes` 的 insert 和状态机）
- 上传文件时根据模板起实例（依赖文件上传模块，同为 P0 但另起一个迭代）
- 审批中心"待我审批"抽屉的通过 / 驳回操作（B 阶段）
- 审批超时催办 24h（C 阶段）
- M2 审批流转、M24 审批链变更 等通知
- 审批人继承机制（部门 / 产品线负责人自动作为审批人）— 等组成员管理 B 阶段一起讨论
- 单组多模板 / 草稿模板 / 模板历史版本
