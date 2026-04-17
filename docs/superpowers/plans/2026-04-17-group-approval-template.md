# 组审批流配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为组设置弹窗的「审批流配置」Tab 落地模板 CRUD（总开关 + 模式 + 有序审批人列表），并在组创建时初始化默认模板，替换当前 `<el-empty>` 占位。

**Architecture:** 后端 2 个接口（GET/PUT 整包保存）+ 改造 1 个接口（组创建同事务初始化模板）+ 前端 1 个新面板组件 + MemberSelectorModal 小改 + GroupSettingsModal 接入。数据：`doc_groups.approval_enabled` 为总开关权威字段；`doc_approval_templates` + `doc_approval_template_nodes` 保存模式和有序审批人。

**Tech Stack:** Nuxt 3 / Nitro / Prisma / Zod / Element Plus / Vue 3 Composition API

**Spec:** `docs/superpowers/specs/2026-04-17-group-approval-template-design.md`

**项目约定提醒：**
- 使用 **tab 缩进**（非空格）
- 消息提示统一用 `useNotify.ts` 的 `msgSuccess/msgError/msgConfirm`，不直接用 `ElMessage/ElMessageBox`
- 前端从 Zod schema 推导请求类型，不另建
- 接口新增必须同步更新 `docs/api-auth-design.md`
- 样式统一放 `assets/styles/components/_modals.scss`，不写组件 `<style>`
- Prisma 模型方法里 BigInt 字段要 `BigInt()` 包裹

---

### Task 1: Zod schema + 错误码 + 服务端类型 + 单元测试

**Files:**
- Create: `server/schemas/approval-template.ts`
- Create: `server/types/approval-template.ts`
- Modify: `server/constants/error-codes.ts`
- Create: `tests/unit/schemas/approval-template.test.ts`

- [ ] **Step 1: 编写 schema 测试**

```typescript
// tests/unit/schemas/approval-template.test.ts
import { describe, it, expect } from 'vitest'
import { saveApprovalTemplateSchema } from '~/server/schemas/approval-template'

describe('saveApprovalTemplateSchema', () => {
	it('接受合法开启配置（依次 + 3 审批人）', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [10001, 10002, 10003],
		})
		expect(result.success).toBe(true)
	})

	it('接受合法关闭配置（审批人可空）', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 0,
			mode: 1,
			approverUserIds: [],
		})
		expect(result.success).toBe(true)
	})

	it('接受会签模式', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 2,
			approverUserIds: [10001],
		})
		expect(result.success).toBe(true)
	})

	it('接受单人审批', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [10001],
		})
		expect(result.success).toBe(true)
	})

	it('拒绝开启审批但审批人为空', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝非法 mode=3', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 3,
			approverUserIds: [10001],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝审批人超过 20 人', () => {
		const ids = Array.from({ length: 21 }, (_, i) => i + 1)
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: ids,
		})
		expect(result.success).toBe(false)
	})

	it('拒绝审批人 userId 重复', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [10001, 10002, 10001],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝审批人 userId 为负数', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [-1],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝审批人 userId 为小数', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [1.5],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝 approvalEnabled=2（非 0/1）', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 2,
			mode: 1,
			approverUserIds: [10001],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝缺字段', () => {
		expect(saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
		}).success).toBe(false)

		expect(saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			approverUserIds: [],
		}).success).toBe(false)
	})
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/schemas/approval-template.test.ts`
Expected: FAIL — `~/server/schemas/approval-template` 不存在

- [ ] **Step 3: 实现 Zod schema**

```typescript
// server/schemas/approval-template.ts
import { z } from 'zod'

const approvalModeSchema = z.union([z.literal(1), z.literal(2)])
const approvalEnabledSchema = z.union([z.literal(0), z.literal(1)])

/** 保存审批模板 — 整包提交 */
export const saveApprovalTemplateSchema = z.object({
	approvalEnabled: approvalEnabledSchema,
	mode: approvalModeSchema,
	approverUserIds: z.array(z.number().int().positive()).max(20),
}).refine(
	(data) => {
		// 开启审批时审批人不能为空
		if (data.approvalEnabled === 1 && data.approverUserIds.length === 0) return false
		return true
	},
	{ message: '开启审批时审批人不能为空', path: ['approverUserIds'] },
).refine(
	(data) => {
		// 审批人 userId 不允许重复
		return new Set(data.approverUserIds).size === data.approverUserIds.length
	},
	{ message: '审批人不能重复', path: ['approverUserIds'] },
)

export type SaveApprovalTemplateBody = z.infer<typeof saveApprovalTemplateSchema>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/schemas/approval-template.test.ts`
Expected: ALL PASS (12 条)

- [ ] **Step 5: 新增错误码**

在 `server/constants/error-codes.ts` 文件末尾（`MEMBER_SELF_REMOVE` 之后）追加：

```typescript
// ─── 审批模板 ───
/** 开启审批时审批人不能为空 (400) */
export const APPROVAL_APPROVERS_REQUIRED = 'APPROVAL_APPROVERS_REQUIRED'
/** 审批人用户不存在或已停用 (400) */
export const APPROVAL_INVALID_APPROVER = 'APPROVAL_INVALID_APPROVER'
```

- [ ] **Step 6: 创建服务端行类型**

```typescript
// server/types/approval-template.ts
/**
 * 组审批模板 — 服务端 DB 行类型
 */

/** 审批模板行（查询用） */
export interface ApprovalTemplateRow {
	id: bigint | number
	group_id: bigint | number
	mode: number
	timeout_hours: number
	enabled: number
}

/** 审批模板节点行（含审批人用户信息） */
export interface ApprovalTemplateNodeRow {
	order_no: number
	approver_user_id: bigint | number
	name: string
	avatar_url: string | null
}

/** 活跃用户校验行 */
export interface ActiveUserRow {
	id: bigint | number
}
```

- [ ] **Step 7: 全量测试 + 提交**

Run: `npx vitest run`
Expected: 所有测试通过（原 101 + 新 12 = 113）

提交信息：
```
feat: 审批模板 — Zod schema、错误码、服务端类型 + 12 条单元测试
```

---

### Task 2: GET /api/groups/:id/approval-template — 读接口（含兜底）

**Files:**
- Create: `server/api/groups/[id]/approval-template.get.ts`

- [ ] **Step 1: 实现读接口**

```typescript
// server/api/groups/[id]/approval-template.get.ts
/**
 * GET /api/groups/:id/approval-template
 * 读取组审批配置。模板不存在时兜底默认（不写库）。
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { GROUP_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'
import type { ApprovalTemplateNodeRow } from '~/server/types/approval-template'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: {
			id: true,
			scope_type: true,
			scope_ref_id: true,
			owner_user_id: true,
			approval_enabled: true,
		},
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireMemberPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
		groupId: id,
	})
	if (denied) return denied

	// 查模板（若存在）
	const template = await prisma.doc_approval_templates.findFirst({
		where: { group_id: BigInt(id), deleted_at: null },
		select: { id: true, mode: true },
	})

	const ownerId = Number(group.owner_user_id)

	if (!template) {
		// 兜底：模板不存在（存量老组），返回默认值，不写库
		const owner = await prisma.doc_users.findFirst({
			where: { id: BigInt(ownerId), deleted_at: null },
			select: { id: true, name: true, avatar_url: true },
		})
		return ok({
			approvalEnabled: group.approval_enabled,
			mode: 1,
			approvers: owner
				? [{
					userId: Number(owner.id),
					name: owner.name,
					avatar: owner.avatar_url,
					isOwner: true,
				}]
				: [],
		})
	}

	// 查审批人节点（按 order_no 排序）
	const nodes = await prisma.$queryRaw<ApprovalTemplateNodeRow[]>`
		SELECT n.order_no, n.approver_user_id, u.name, u.avatar_url
		FROM doc_approval_template_nodes n
		JOIN doc_users u ON u.id = n.approver_user_id
		WHERE n.template_id = ${Number(template.id)}
		ORDER BY n.order_no ASC
	`

	return ok({
		approvalEnabled: group.approval_enabled,
		mode: template.mode,
		approvers: nodes.map(n => ({
			userId: Number(n.approver_user_id),
			name: n.name,
			avatar: n.avatar_url,
			isOwner: Number(n.approver_user_id) === ownerId,
		})),
	})
})
```

- [ ] **Step 2: 提交**

```
feat: 审批模板 — GET /api/groups/:id/approval-template 读接口（含兜底）
```

---

### Task 3: PUT /api/groups/:id/approval-template — 整包保存

**Files:**
- Create: `server/api/groups/[id]/approval-template.put.ts`

- [ ] **Step 1: 实现保存接口**

```typescript
// server/api/groups/[id]/approval-template.put.ts
/**
 * PUT /api/groups/:id/approval-template
 * 整包保存审批模板（开关 + 模式 + 有序审批人）
 * 事务内：upsert templates → 删 nodes → 批量 insert nodes → 更新 approval_enabled
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { saveApprovalTemplateSchema } from '~/server/schemas/approval-template'
import {
	GROUP_NOT_FOUND,
	INVALID_PARAMS,
	APPROVAL_APPROVERS_REQUIRED,
	APPROVAL_INVALID_APPROVER,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const body = await readValidatedBody(event, saveApprovalTemplateSchema.parse)
	const userId = event.context.user!.id

	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: {
			id: true,
			scope_type: true,
			scope_ref_id: true,
			owner_user_id: true,
		},
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireMemberPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
		groupId: id,
	})
	if (denied) return denied

	// 二次校验（schema refine 已校验，这里兜底防止绕过）
	if (body.approvalEnabled === 1 && body.approverUserIds.length === 0) {
		return fail(event, 400, APPROVAL_APPROVERS_REQUIRED, '开启审批时审批人不能为空')
	}

	// 校验所有审批人是活跃用户
	if (body.approverUserIds.length > 0) {
		const activeUsers = await prisma.doc_users.findMany({
			where: {
				id: { in: body.approverUserIds.map(u => BigInt(u)) },
				status: 1,
				deleted_at: null,
			},
			select: { id: true },
		})
		if (activeUsers.length !== body.approverUserIds.length) {
			return fail(event, 400, APPROVAL_INVALID_APPROVER, '存在已停用或不存在的审批人')
		}
	}

	// 查现有模板（用于事务内复用 template_id）
	const existing = await prisma.doc_approval_templates.findFirst({
		where: { group_id: BigInt(id), deleted_at: null },
		select: { id: true },
	})

	const templateId = existing ? existing.id : generateId()

	await prisma.$transaction(async (tx) => {
		if (existing) {
			await tx.doc_approval_templates.update({
				where: { id: existing.id },
				data: { mode: body.mode, updated_at: new Date() },
			})
		} else {
			await tx.doc_approval_templates.create({
				data: {
					id: templateId,
					group_id: BigInt(id),
					mode: body.mode,
					timeout_hours: 24,
					enabled: 1,
					created_by: BigInt(userId),
				},
			})
		}

		// 删旧 nodes
		await tx.doc_approval_template_nodes.deleteMany({
			where: { template_id: templateId },
		})

		// 批量插入新 nodes，按数组顺序 order_no 从 1 起
		if (body.approverUserIds.length > 0) {
			await tx.doc_approval_template_nodes.createMany({
				data: body.approverUserIds.map((uid, idx) => ({
					id: generateId(),
					template_id: templateId,
					order_no: idx + 1,
					approver_user_id: BigInt(uid),
				})),
			})
		}

		// 更新组总开关
		await tx.doc_groups.update({
			where: { id: BigInt(id) },
			data: { approval_enabled: body.approvalEnabled, updated_at: new Date() },
		})
	})

	return ok(null, '审批配置已保存')
})
```

- [ ] **Step 2: 提交**

```
feat: 审批模板 — PUT /api/groups/:id/approval-template 整包保存接口
```

---

### Task 4: 改造组创建接口 — 同事务初始化默认模板

**Files:**
- Modify: `server/api/groups/index.post.ts`

- [ ] **Step 1: 打开当前文件定位插入点**

找到 `prisma.$transaction([...])` 这一段代码块（含 `doc_groups.create` 和 `doc_group_members.create`）。需要：
1. 给 `doc_groups.create.data` 显式传 `approval_enabled: 1`
2. 在事务数组里追加 `doc_approval_templates.create` 和 `doc_approval_template_nodes.create`

- [ ] **Step 2: 修改组创建事务**

把原来的：

```typescript
const groupId = generateId()
const memberId = generateId()

try {
	await prisma.$transaction([
		prisma.doc_groups.create({
			data: {
				id: groupId,
				parent_id: parentId ? BigInt(parentId) : null,
				scope_type: effectiveScopeType,
				scope_ref_id: effectiveScopeRefId ? BigInt(effectiveScopeRefId) : null,
				name,
				description,
				owner_user_id: BigInt(userId),
				created_by: BigInt(userId),
			},
		}),
		prisma.doc_group_members.create({
			data: {
				id: memberId,
				group_id: groupId,
				user_id: BigInt(userId),
				role: 1,
				source_type: 1,
				immutable_flag: 1,
				created_by: BigInt(userId),
			},
		}),
	])
}
```

改成：

```typescript
const groupId = generateId()
const memberId = generateId()
const templateId = generateId()
const nodeId = generateId()

try {
	await prisma.$transaction([
		prisma.doc_groups.create({
			data: {
				id: groupId,
				parent_id: parentId ? BigInt(parentId) : null,
				scope_type: effectiveScopeType,
				scope_ref_id: effectiveScopeRefId ? BigInt(effectiveScopeRefId) : null,
				name,
				description,
				owner_user_id: BigInt(userId),
				created_by: BigInt(userId),
				approval_enabled: 1,
			},
		}),
		prisma.doc_group_members.create({
			data: {
				id: memberId,
				group_id: groupId,
				user_id: BigInt(userId),
				role: 1,
				source_type: 1,
				immutable_flag: 1,
				created_by: BigInt(userId),
			},
		}),
		// PRD §244：创建组默认开启审批，审批人为组负责人
		prisma.doc_approval_templates.create({
			data: {
				id: templateId,
				group_id: groupId,
				mode: 1,
				timeout_hours: 24,
				enabled: 1,
				created_by: BigInt(userId),
			},
		}),
		prisma.doc_approval_template_nodes.create({
			data: {
				id: nodeId,
				template_id: templateId,
				order_no: 1,
				approver_user_id: BigInt(userId),
			},
		}),
	])
}
```

- [ ] **Step 3: 手动验证（dev 服启动 + 创建组）**

Run: `npm run dev`
在浏览器 `/docs` 页面：
1. 创建一个新组
2. 打开组设置弹窗（"设置"按钮）→ 切到"审批流配置"Tab（此 Tab 内容将在 Task 7/8 做出来，当前仍是占位；但可以用 SQL/数据库工具验证表里有记录）

数据库验证 SQL：
```sql
SELECT g.id, g.name, g.approval_enabled,
	t.id AS template_id, t.mode,
	n.order_no, n.approver_user_id
FROM doc_groups g
LEFT JOIN doc_approval_templates t ON t.group_id = g.id AND t.deleted_at IS NULL
LEFT JOIN doc_approval_template_nodes n ON n.template_id = t.id
WHERE g.deleted_at IS NULL
ORDER BY g.created_at DESC LIMIT 5;
```

应能看到新建的组有 `approval_enabled=1`，templates 表有一条 mode=1，nodes 表有一条 approver=创建人。

- [ ] **Step 4: 提交**

```
feat: 组创建时同事务初始化审批模板（默认开启 + 依次 + 组负责人）
```

---

### Task 5: 前端类型 + API 封装

**Files:**
- Create: `types/approval-template.ts`
- Create: `api/approval-template.ts`

- [ ] **Step 1: 创建前端类型**

```typescript
// types/approval-template.ts
/**
 * 组审批模板 — 前端类型
 */

// 从 Zod schema 推导请求类型
export type { SaveApprovalTemplateBody } from '~/server/schemas/approval-template'

/** 审批模式文案映射 */
export const APPROVAL_MODE_MAP: Record<number, string> = {
	1: '依次审批',
	2: '会签审批',
}

/** 审批人列表项 */
export interface ApprovalApprover {
	userId: number
	name: string
	avatar: string | null
	isOwner: boolean
}

/** 审批模板读取返回 */
export interface ApprovalTemplate {
	approvalEnabled: 0 | 1
	mode: 1 | 2
	approvers: ApprovalApprover[]
}
```

- [ ] **Step 2: 创建 API 封装**

```typescript
// api/approval-template.ts
import type { ApiResult } from '~/types/api'
import type { ApprovalTemplate, SaveApprovalTemplateBody } from '~/types/approval-template'

/** 读组审批配置 */
export function apiGetApprovalTemplate(groupId: number) {
	return useAuthFetch<ApiResult<ApprovalTemplate>>(`/api/groups/${groupId}/approval-template`)
}

/** 保存组审批配置（整包） */
export function apiSaveApprovalTemplate(groupId: number, body: SaveApprovalTemplateBody) {
	return useAuthFetch<ApiResult>(`/api/groups/${groupId}/approval-template`, {
		method: 'PUT',
		body,
	})
}
```

- [ ] **Step 3: 提交**

```
feat: 审批模板 — 前端类型 + API 封装
```

---

### Task 6: MemberSelectorModal 新增 showRoleSelector prop

**Files:**
- Modify: `components/MemberSelectorModal.vue`

**背景**：审批人选择场景不需要 footer 里的权限下拉。加一个 prop 控制显隐，默认 true（兼容现有成员管理场景）。

- [ ] **Step 1: 修改 props 和 emits**

定位 `defineProps` 和 `defineEmits`：

原来：
```typescript
const props = withDefaults(defineProps<{
	visible: boolean
	groupId?: number
	multiple?: boolean
	excludeUserIds?: number[]
}>(), {
	groupId: undefined,
	multiple: true,
	excludeUserIds: () => [],
})

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'confirm': [users: SelectedUser[], role: number]
}>()
```

改成：

```typescript
const props = withDefaults(defineProps<{
	visible: boolean
	groupId?: number
	multiple?: boolean
	excludeUserIds?: number[]
	showRoleSelector?: boolean
}>(), {
	groupId: undefined,
	multiple: true,
	excludeUserIds: () => [],
	showRoleSelector: true,
})

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'confirm': [users: SelectedUser[], role: number]
}>()
```

（emit 签名不变：在 `showRoleSelector=false` 场景下调用方接收 role 但忽略即可，保持接口稳定）

- [ ] **Step 2: 修改 footer 模板**

定位 `<template #footer>` 这块，给 `.ms-footer__role` 加 `v-if`：

原来：
```vue
<template #footer>
	<div class="ms-footer">
		<div class="ms-footer__role">
			<span class="ms-footer__role-label">默认权限</span>
			<el-select v-model="selectedRole" size="default" style="width: 130px">
				<el-option :value="1" label="管理员" />
				<el-option :value="2" label="可编辑" />
				<el-option :value="3" label="上传下载" />
			</el-select>
		</div>
		<div class="ms-footer__actions">
			<el-button @click="close">取消</el-button>
			<el-button type="primary" :disabled="selectedUsers.length === 0" @click="handleConfirm">
				确认{{ selectedUsers.length > 0 ? `（${selectedUsers.length}）` : '' }}
			</el-button>
		</div>
	</div>
</template>
```

改成：
```vue
<template #footer>
	<div class="ms-footer" :class="{ 'ms-footer--no-role': !showRoleSelector }">
		<div v-if="showRoleSelector" class="ms-footer__role">
			<span class="ms-footer__role-label">默认权限</span>
			<el-select v-model="selectedRole" size="default" style="width: 130px">
				<el-option :value="1" label="管理员" />
				<el-option :value="2" label="可编辑" />
				<el-option :value="3" label="上传下载" />
			</el-select>
		</div>
		<div class="ms-footer__actions">
			<el-button @click="close">取消</el-button>
			<el-button type="primary" :disabled="selectedUsers.length === 0" @click="handleConfirm">
				确认{{ selectedUsers.length > 0 ? `（${selectedUsers.length}）` : '' }}
			</el-button>
		</div>
	</div>
</template>
```

- [ ] **Step 3: 样式追加（让 actions 在无 role 时靠右）**

修改 `assets/styles/components/_modals.scss` 里已有的 `.ms-footer` 规则，追加一条：

```scss
.ms-footer--no-role {
  justify-content: flex-end;
}
```

- [ ] **Step 4: 验证已有成员管理场景没回归**

Run: `npm run dev`
浏览器操作：
1. 打开任一组设置 → 成员管理 Tab → 邀请成员
2. 选择器底部仍显示"默认权限"下拉（因为默认 `showRoleSelector=true`）
3. 确认功能无变化

- [ ] **Step 5: 提交**

```
feat: MemberSelectorModal 新增 showRoleSelector prop（审批人选择场景用）
```

---

### Task 7: GroupApprovalPanel.vue 审批流配置面板

**Files:**
- Create: `components/GroupApprovalPanel.vue`

- [ ] **Step 1: 创建面板组件**

```vue
<!-- components/GroupApprovalPanel.vue -->
<template>
	<div v-loading="loading" class="ap-panel">
		<!-- ① 总开关卡片 -->
		<div class="ap-card ap-switch-card">
			<div class="ap-card__header">
				<span class="ap-card__title">上传需审批</span>
				<el-switch v-model="approvalEnabledBool" />
			</div>
			<div class="ap-switch-card__hint">
				{{ form.approvalEnabled
					? '已开启：普通成员上传文件需经审批人审批后才能发布'
					: '已关闭：所有上传文件将直接发布（组负责人/管理员始终免审批）' }}
			</div>
		</div>

		<!-- ② 关闭态空态 -->
		<div v-if="form.approvalEnabled === 0" class="ap-empty">
			<el-empty description="审批已关闭，所有上传文件将直接发布" :image-size="100">
				<div class="ap-empty__hint">开启后可配置审批模式和审批人</div>
			</el-empty>
		</div>

		<!-- ③ 审批模式 -->
		<div v-else class="ap-card">
			<div class="ap-card__header"><span class="ap-card__title">审批模式</span></div>
			<div class="ap-mode-wrap">
				<div
					class="ap-mode-card"
					:class="{ 'ap-mode-card--selected': form.mode === 1 }"
					@click="form.mode = 1">
					<div class="ap-mode-card__head">
						<el-icon :size="16"><Right /></el-icon>
						<span>依次审批</span>
					</div>
					<div class="ap-mode-card__desc">按顺序逐个审批，第 1 人通过后才轮到第 2 人，适合需要层级把关的场景。</div>
				</div>
				<div
					class="ap-mode-card"
					:class="{ 'ap-mode-card--selected': form.mode === 2 }"
					@click="form.mode = 2">
					<div class="ap-mode-card__head">
						<el-icon :size="16"><Sort /></el-icon>
						<span>会签审批</span>
					</div>
					<div class="ap-mode-card__desc">所有审批人同时收到审批请求，全部通过后文件才会发布，适合需要多方确认的场景。</div>
				</div>
			</div>
		</div>

		<!-- ④ 审批人列表 -->
		<div v-if="form.approvalEnabled === 1" class="ap-card">
			<div class="ap-card__header">
				<span class="ap-card__title">审批人</span>
				<span class="ap-card__hint">审批人可以是系统中任何用户</span>
				<el-button
					type="primary" size="small"
					:disabled="form.approvers.length >= 20"
					@click="openSelector">
					<el-icon :size="14"><Plus /></el-icon>
					添加审批人
				</el-button>
			</div>

			<div class="ap-approver-list">
				<div
					v-for="(ap, idx) in form.approvers" :key="ap.userId"
					class="ap-approver-row">
					<span class="ap-approver-row__order">{{ idx + 1 }}</span>
					<span class="ap-approver-row__avatar">{{ ap.name?.slice(0, 1) }}</span>
					<span class="ap-approver-row__name">{{ ap.name }}</span>
					<el-tag v-if="ap.isOwner" type="danger" size="small" effect="plain" round>
						组负责人
					</el-tag>

					<div class="ap-approver-row__actions">
						<el-button
							text size="small"
							:disabled="idx === 0"
							@click="moveUp(idx)">
							<el-icon :size="14"><ArrowUp /></el-icon>
						</el-button>
						<el-button
							text size="small"
							:disabled="idx === form.approvers.length - 1"
							@click="moveDown(idx)">
							<el-icon :size="14"><ArrowDown /></el-icon>
						</el-button>
						<el-button
							v-if="form.approvers.length > 1"
							text size="small" type="danger"
							@click="removeApprover(idx)">
							<el-icon :size="14"><Close /></el-icon>
						</el-button>
					</div>
				</div>
			</div>
		</div>

		<!-- ⑤ 审批链预览 -->
		<div
			v-if="form.approvalEnabled === 1 && form.approvers.length > 0"
			class="ap-card ap-preview">
			<div class="ap-card__header">
				<span class="ap-card__title">审批流预览（{{ modeLabel }}）</span>
			</div>

			<!-- 依次 -->
			<div v-if="form.mode === 1" class="ap-chain">
				<div class="ap-chain__node ap-chain__node--neutral">提交人上传</div>
				<template v-for="(ap, idx) in form.approvers" :key="ap.userId">
					<span class="ap-chain__arrow">→</span>
					<div class="ap-chain__node">
						<span class="ap-chain__avatar">{{ ap.name?.slice(0, 1) }}</span>
						<span>{{ ap.name }}</span>
					</div>
				</template>
				<span class="ap-chain__arrow">→</span>
				<div class="ap-chain__node ap-chain__node--success">发布</div>
			</div>

			<!-- 会签 -->
			<div v-else class="ap-chain">
				<div class="ap-chain__node ap-chain__node--neutral">提交人上传</div>
				<span class="ap-chain__arrow">→</span>
				<div class="ap-chain__parallel">
					<div class="ap-chain__parallel-label">同时审批</div>
					<div v-for="ap in form.approvers" :key="ap.userId" class="ap-chain__parallel-item">
						<span class="ap-chain__avatar">{{ ap.name?.slice(0, 1) }}</span>
						<span>{{ ap.name }}</span>
					</div>
				</div>
				<span class="ap-chain__arrow">→</span>
				<span class="ap-chain__hint">全部通过</span>
				<span class="ap-chain__arrow">→</span>
				<div class="ap-chain__node ap-chain__node--success">发布</div>
			</div>
		</div>

		<!-- ⑥ 底部操作区 -->
		<div class="ap-footer">
			<el-button :disabled="!isDirty" @click="reset">取消修改</el-button>
			<el-button
				type="primary" :loading="saving" :disabled="!canSave"
				@click="handleSave">
				保存
			</el-button>
		</div>

		<!-- 审批人选择器 -->
		<MemberSelectorModal
			v-model:visible="selectorVisible"
			:exclude-user-ids="excludeUserIdsForSelector"
			:show-role-selector="false"
			@confirm="onApproverSelected" />
	</div>
</template>

<script setup lang="ts">
import { Plus, ArrowUp, ArrowDown, Close, Right, Sort } from '@element-plus/icons-vue'
import type { ApprovalTemplate, ApprovalApprover } from '~/types/approval-template'
import { APPROVAL_MODE_MAP } from '~/types/approval-template'
import { apiGetApprovalTemplate, apiSaveApprovalTemplate } from '~/api/approval-template'
import type { SelectedUser } from '~/types/group-member'

const props = defineProps<{
	groupId: number
}>()

const emit = defineEmits<{
	success: []
}>()

const loading = ref(false)
const saving = ref(false)
const selectorVisible = ref(false)

const form = ref<ApprovalTemplate>({
	approvalEnabled: 1,
	mode: 1,
	approvers: [],
})
const original = ref<ApprovalTemplate | null>(null)

// 开关 v-model 桥（0/1 ↔ boolean）
const approvalEnabledBool = computed({
	get: () => form.value.approvalEnabled === 1,
	set: (val: boolean) => { form.value.approvalEnabled = val ? 1 : 0 },
})

const modeLabel = computed(() => APPROVAL_MODE_MAP[form.value.mode] || '')

const excludeUserIdsForSelector = computed(() => form.value.approvers.map(a => a.userId))

const isDirty = computed(() => {
	if (!original.value) return false
	return JSON.stringify(form.value) !== JSON.stringify(original.value)
})

const isValid = computed(() => {
	if (form.value.approvalEnabled === 0) return true
	return form.value.approvers.length >= 1
})

const canSave = computed(() => isDirty.value && isValid.value && !saving.value)

async function load() {
	loading.value = true
	try {
		const res = await apiGetApprovalTemplate(props.groupId)
		if (res.success) {
			form.value = JSON.parse(JSON.stringify(res.data))
			original.value = JSON.parse(JSON.stringify(res.data))
		}
	} finally {
		loading.value = false
	}
}

function reset() {
	if (!original.value) return
	form.value = JSON.parse(JSON.stringify(original.value))
}

function openSelector() {
	if (form.value.approvers.length >= 20) return
	selectorVisible.value = true
}

function onApproverSelected(users: SelectedUser[]) {
	// 追加新审批人，忽略 role（showRoleSelector=false 时选择器不传 role 语义，接收但不用）
	for (const u of users) {
		if (form.value.approvers.some(a => a.userId === u.id)) continue
		if (form.value.approvers.length >= 20) break
		form.value.approvers.push({
			userId: u.id,
			name: u.name,
			avatar: u.avatar,
			isOwner: false, // GET 时才知道是否 owner；本地新加的不是 owner（除非加进来的恰好是 owner，稍后 load 会刷新）
		})
	}
}

function moveUp(idx: number) {
	if (idx === 0) return
	const arr = form.value.approvers
	;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
}

function moveDown(idx: number) {
	const arr = form.value.approvers
	if (idx === arr.length - 1) return
	;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
}

function removeApprover(idx: number) {
	if (form.value.approvers.length <= 1) return
	form.value.approvers.splice(idx, 1)
}

async function handleSave() {
	if (!canSave.value) return
	saving.value = true
	try {
		const res = await apiSaveApprovalTemplate(props.groupId, {
			approvalEnabled: form.value.approvalEnabled,
			mode: form.value.mode,
			approverUserIds: form.value.approvers.map(a => a.userId),
		})
		if (res.success) {
			msgSuccess(res.message || '保存成功')
			emit('success')
			// 重新加载以刷新 isOwner 等服务端计算字段
			await load()
		} else {
			msgError(res.message || '保存失败')
		}
	} finally {
		saving.value = false
	}
}

defineExpose({
	isDirty,
	reset,
})

watch(() => props.groupId, () => load(), { immediate: true })
</script>
```

- [ ] **Step 2: 提交**

```
feat: GroupApprovalPanel 审批流配置面板（开关/模式/审批人/链路预览/保存）
```

---

### Task 8: GroupSettingsModal 接入 + dirty 拦截 + 默认 Tab

**Files:**
- Modify: `components/GroupSettingsModal.vue`

- [ ] **Step 1: 替换占位 + 引入 ref**

找到第一个 `<el-tab-pane label="审批流配置" name="approval">`，把里面的 `<el-empty>` 占位换成 `<GroupApprovalPanel>`：

原来：
```vue
<el-tab-pane label="审批流配置" name="approval">
	<div class="gs-placeholder">
		<el-empty description="审批流配置即将上线" :image-size="100" />
	</div>
</el-tab-pane>
```

改成：
```vue
<el-tab-pane label="审批流配置" name="approval">
	<GroupApprovalPanel
		ref="approvalPanelRef"
		:group-id="groupId"
		@success="$emit('success')" />
</el-tab-pane>
```

- [ ] **Step 2: 修改默认 Tab 和加 dirty 拦截 ref**

找到 script 中 `const activeTab = ref('members')`，改为：

```typescript
const activeTab = ref('approval')
const approvalPanelRef = ref<{ isDirty: boolean; reset: () => void } | null>(null)
```

- [ ] **Step 3: 加 Tab 切换前拦截**

给 `<el-tabs v-model="activeTab">` 加 `:before-leave` 属性：

原来：
```vue
<el-tabs v-model="activeTab">
```

改成：
```vue
<el-tabs v-model="activeTab" :before-leave="beforeLeaveTab">
```

在 script 中加函数：

```typescript
async function beforeLeaveTab(_activeName: string, oldActiveName: string): Promise<boolean> {
	// 仅当离开 approval Tab 且有未保存修改时拦截
	if (oldActiveName === 'approval' && approvalPanelRef.value?.isDirty) {
		const ok = await msgConfirm('审批流配置有未保存的修改，确认放弃？', '放弃修改')
		if (ok && approvalPanelRef.value) {
			approvalPanelRef.value.reset()
		}
		return ok
	}
	return true
}
```

- [ ] **Step 4: 修改关弹窗拦截**

找到 `function close()`，改为异步 + dirty 检查：

原来：
```typescript
function close() {
	emit('update:visible', false)
}
```

改成：
```typescript
async function close() {
	if (activeTab.value === 'approval' && approvalPanelRef.value?.isDirty) {
		const ok = await msgConfirm('审批流配置有未保存的修改，确认放弃？', '放弃修改')
		if (!ok) return
		approvalPanelRef.value.reset()
	}
	emit('update:visible', false)
}
```

对应 `<el-dialog ... @close="close">` 因为 `close` 变异步，Element Plus 会正确 await 它。

- [ ] **Step 5: 验证**

Run: `npm run dev`
浏览器：
1. 打开任一组设置 → 默认停留在"审批流配置"Tab ✓
2. 改审批人顺序 → 切"成员管理"Tab → 弹"放弃修改"确认
3. 点取消 → 留在当前 Tab
4. 点确定 → 切成功，刚才的修改被 reset
5. 再改一次 → 点关弹窗 X → 同样的拦截

- [ ] **Step 6: 提交**

```
feat: GroupSettingsModal 接入 GroupApprovalPanel + dirty 拦截 + 默认 Tab 改 approval
```

---

### Task 9: 样式追加

**Files:**
- Modify: `assets/styles/components/_modals.scss`

- [ ] **Step 1: 末尾追加审批面板样式**

在文件末尾追加（保持与现有 `.gm-panel__*` 风格一致）：

```scss
/* ── 审批流配置面板 ── */
.ap-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ap-card {
  border: 1px solid var(--df-border);
  border-radius: 8px;
  background: var(--df-panel);
  overflow: hidden;
}

.ap-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--df-border);
  font-size: 14px;

  .el-button {
    margin-left: auto;
  }
}

.ap-card__title {
  font-weight: 600;
  color: var(--df-text);
}

.ap-card__hint {
  font-size: 12px;
  color: var(--df-subtext);
}

.ap-switch-card {
  .ap-card__header {
    border-bottom: none;
    padding-bottom: 8px;
  }
}

.ap-switch-card__hint {
  padding: 0 16px 14px;
  font-size: 12px;
  color: var(--df-subtext);
}

.ap-empty {
  padding: 40px 0;
  text-align: center;

  &__hint {
    margin-top: 6px;
    font-size: 12px;
    color: var(--df-subtext);
  }
}

/* 模式卡片 */
.ap-mode-wrap {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
}

.ap-mode-card {
  flex: 1;
  padding: 14px;
  border: 2px solid var(--df-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    background: var(--df-surface);
  }

  &--selected {
    border-color: var(--df-primary);
    background: var(--df-primary-soft);
  }
}

.ap-mode-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--df-text);
}

.ap-mode-card__desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--df-subtext);
}

/* 审批人列表 */
.ap-approver-list {
  padding: 8px 0;
}

.ap-approver-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;

  &:hover {
    background: var(--df-surface);
  }
}

.ap-approver-row__order {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--df-surface);
  color: var(--df-subtext);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ap-approver-row__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--df-primary), #818cf8);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ap-approver-row__name {
  flex: 1;
  font-size: 14px;
  color: var(--df-text);
}

.ap-approver-row__actions {
  display: flex;
  gap: 2px;
}

/* 审批链预览 */
.ap-preview .ap-card__header {
  background: var(--df-primary-soft);
}

.ap-chain {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 16px;
}

.ap-chain__node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--df-border);
  border-radius: 6px;
  background: var(--df-panel);
  font-size: 13px;
  color: var(--df-text);

  &--neutral {
    color: var(--df-subtext);
  }

  &--success {
    border-color: #22c55e;
    background: #f0fdf4;
    color: #15803d;
  }
}

.ap-chain__avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--df-primary), #818cf8);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ap-chain__arrow {
  color: var(--df-subtext);
  font-size: 14px;
}

.ap-chain__parallel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border: 1.5px dashed #f59e0b;
  border-radius: 8px;
  background: var(--df-panel);
}

.ap-chain__parallel-label {
  font-size: 11px;
  font-weight: 600;
  color: #f59e0b;
}

.ap-chain__parallel-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.ap-chain__hint {
  font-size: 12px;
  color: var(--df-subtext);
}

/* 底部操作区 */
.ap-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--df-border);
  margin-top: 4px;
}

/* MemberSelectorModal 无权限下拉时 footer 布局 */
.ms-footer--no-role {
  justify-content: flex-end;
}
```

注意：`.ms-footer--no-role` 这条已经在 Task 6 加过。若重复就保留一份。

- [ ] **Step 2: 提交**

```
style: 审批流配置面板样式（模式卡片 / 审批人行 / 链路预览）
```

---

### Task 10: 更新接口文档 + 开发进度

**Files:**
- Modify: `docs/api-auth-design.md`
- Modify: `docs/dev-progress.md`
- Modify: `docs/feature-gap-checklist.md`

- [ ] **Step 1: api-auth-design.md 接口总览追加**

在「组成员管理」组章节下方追加新章节：

```markdown
### 组审批流配置 (approval-template)

| 方法 | 路径 | 鉴权 | 权限/条件 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/groups/:id/approval-template | 是 | 组管理权限 | 读取组审批配置（模板不存在时兜底默认值） |
| PUT | /api/groups/:id/approval-template | 是 | 组管理权限 | 整包保存审批配置（开关 + 模式 + 审批人有序列表） |

> 组管理权限等同「组成员管理」：组负责人 / scope 管理角色 / 组内管理员（role=1）。
```

- [ ] **Step 2: 接口详情追加**

在「3.38 GET /api/users/tree」之后、「3.39 GET /api/product-lines」之前追加两节，后续编号各自 +2（由原 3.39 起变 3.41 起）：

```markdown
### 3.39 GET /api/groups/:id/approval-template

读取组审批配置。模板不存在时兜底返回默认值（不写库）。

**成功响应 data：**
\```json
{
  "approvalEnabled": 1,
  "mode": 1,
  "approvers": [
    { "userId": 10002, "name": "张三", "avatar": "https://...", "isOwner": true },
    { "userId": 10005, "name": "李四", "avatar": null, "isOwner": false }
  ]
}
\```

字段说明：
- `approvalEnabled`：取自 `doc_groups.approval_enabled`（0/1）
- `mode`：1=依次审批 / 2=会签审批
- `approvers`：按 `order_no ASC` 返回，`isOwner` 表示是否当前组负责人

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND, PERMISSION_DENIED

---

### 3.40 PUT /api/groups/:id/approval-template

整包保存审批配置。服务端在一个事务内 upsert 模板、批量重建审批人 nodes、更新组总开关。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| approvalEnabled | number | 是 | 0 或 1 |
| mode | number | 是 | 1=依次 / 2=会签 |
| approverUserIds | number[] | 是 | 审批人 userId 数组（顺序即审批顺序，1..20，去重，`approvalEnabled=1` 时非空） |

**权限：** 组管理权限（组负责人 / scope 管理角色 / 组内管理员）。

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND, PERMISSION_DENIED, APPROVAL_APPROVERS_REQUIRED, APPROVAL_INVALID_APPROVER
```

并把原 3.39 及以后的编号（`GET /api/product-lines` 等）**依次加 2**：3.39→3.41、3.40→3.42、3.41→3.43、3.42→3.44。

- [ ] **Step 3: dev-progress.md 追加条目**

在 `## 2026-04-17` 的最末尾追加：

```markdown
### feat: 组审批流配置 Tab
- **后端**
  - 新增 2 个接口：`GET /api/groups/:id/approval-template`（含兜底默认）+ `PUT /api/groups/:id/approval-template`（整包保存事务）
  - 组创建同事务初始化默认模板：mode=1 依次审批 + 审批人=组负责人 + `approval_enabled=1`
  - 新增错误码：`APPROVAL_APPROVERS_REQUIRED` / `APPROVAL_INVALID_APPROVER`
- **前端**
  - 新增 `GroupApprovalPanel` — 组设置弹窗第一 Tab，包含总开关 / 模式选择（依次/会签卡片） / 审批人列表（上移下移移除） / 链路预览 / 保存操作
  - 复用 `MemberSelectorModal`，新增 prop `showRoleSelector`（审批人选择场景隐藏权限下拉）
  - `GroupSettingsModal` 默认 Tab 改为 `'approval'`；dirty 时切 Tab / 关弹窗走 `msgConfirm` 二次确认
- **规格依据**：PRD §243-249（公司层组设置-审批流配置）、§317 / §393（部门 / 产品线组沿用）、§244（默认开启 + 依次 + 组负责人）
- **范围**：A 阶段（模板 CRUD）；不涉及审批实例运行、超时催办、通知，等对应模块再做
- **测试**：12 条 schema 单测（合法 / 边界 / 非法）
```

- [ ] **Step 4: feature-gap-checklist.md 勾选项**

找到「组设置 — 审批流配置 tab」一行，改为：

```markdown
- [x] ~~组设置 — 审批流配置 tab~~ ✅ 2026-04-17（`GroupApprovalPanel`，整包 PUT + 组创建时初始化默认模板）
```

在「已完成组件表」追加：

```markdown
| GroupApprovalPanel（审批流配置面板：开关 / 模式 / 审批人 / 链路预览） | 2026-04-17 |
```

在「已完成后端」表追加：

```markdown
| 组审批模板 A 阶段（2 接口 + 组创建初始化） | 2026-04-17 |
```

- [ ] **Step 5: 提交**

```
docs: 审批流配置 — 接口文档 + 开发进度 + 功能清单 同步
```

---

### Task 11: 手动冒烟

- [ ] **Step 1: 启动 dev 并逐条验证**

Run: `npm run dev`

在浏览器逐项走：

1. **组创建默认值**：创建一个新组 → 打开组设置 → 停在"审批流配置"Tab 默认激活 → 开关=开、模式=依次、审批人列表仅 1 人（创建人，有"组负责人"红 tag）
2. **关闭开关**：点开关 → 下方显示 `<el-empty>` "审批已关闭" → 顶部文案变"已关闭：所有上传文件将直接发布"
3. **重开开关**：审批人列表、模式回显原值（数据从未被删）
4. **切模式**：点"会签审批"卡片 → 卡片 border 高亮 → 预览区从横向链变为并列 "同时审批" 虚线框
5. **添加审批人**：点"+ 添加审批人" → 弹出 `MemberSelectorModal`，底部**无**"默认权限"下拉；已选成员灰显 → 选 2 人 → 确认 → 审批人列表新增 2 行
6. **上移 / 下移**：点 ▲ ▼ → 列表顺序变化；第 1 行 ▲ 禁用、最后行 ▼ 禁用
7. **移除审批人到 1 人**：依次点 × → 剩 1 人时该行的 × 不再显示
8. **保存**：点"保存" → toast"保存成功" → 关弹窗重开 → 状态回显
9. **dirty 拦截 - 切 Tab**：改顺序 → 切"成员管理"Tab → `msgConfirm`"审批流配置有未保存的修改，确认放弃？" → 点"取消"留在当前 Tab → 再切一次点"确定"切成功，顺序还原
10. **dirty 拦截 - 关弹窗**：改顺序 → 关闭弹窗 X → 同样拦截
11. **校验 - 开关=开但审批人空**：把审批人删光（手动做，或模拟：先全选开关=开 + 审批人 0 个）→ "保存"按钮 disabled
12. **权限 - 非管理员**：换一个非管理员账号（或直接 curl 带那个账号的 token）→ `GET /api/groups/:id/approval-template` → 返回 `403 PERMISSION_DENIED`
13. **老组兜底**：在数据库里找一个没 `doc_approval_templates` 记录的老组（seed 数据可能有）→ 打开组设置 → 审批流 Tab 能正常显示默认值（mode=1, approvers=[组负责人]）→ 不改直接关弹窗不触发拦截（因为 original = form）→ 改了再保存，DB 才真正写入记录

- [ ] **Step 2: 全量测试 + lint**

```bash
npx vitest run
npm run lint
```

期望：全绿。

- [ ] **Step 3: 提交（如有修正）**

若冒烟发现问题，以 `fix: ...` 提交；没问题本 Task 不提交。

---

## 文件清单汇总

### 新增（8 个）

| 文件 | Task |
|---|---|
| `server/schemas/approval-template.ts` | 1 |
| `server/types/approval-template.ts` | 1 |
| `tests/unit/schemas/approval-template.test.ts` | 1 |
| `server/api/groups/[id]/approval-template.get.ts` | 2 |
| `server/api/groups/[id]/approval-template.put.ts` | 3 |
| `types/approval-template.ts` | 5 |
| `api/approval-template.ts` | 5 |
| `components/GroupApprovalPanel.vue` | 7 |

### 修改（6 个）

| 文件 | Task | 修改 |
|---|---|---|
| `server/constants/error-codes.ts` | 1 | +2 错误码 |
| `server/api/groups/index.post.ts` | 4 | 同事务追加 template + node + `approval_enabled=1` |
| `components/MemberSelectorModal.vue` | 6 | +`showRoleSelector` prop |
| `components/GroupSettingsModal.vue` | 8 | 第一 Tab 换 panel / 默认 tab=approval / dirty 拦截 |
| `assets/styles/components/_modals.scss` | 9 + 6 | +审批面板样式 + `.ms-footer--no-role` |
| `docs/api-auth-design.md` | 10 | +2 接口章节 + 原编号递增 |
| `docs/dev-progress.md` | 10 | 追加 2026-04-17 条目 |
| `docs/feature-gap-checklist.md` | 10 | 勾选"审批流配置 tab" + 已完成表追加 |
