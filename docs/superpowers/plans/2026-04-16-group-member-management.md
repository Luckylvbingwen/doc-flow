# 组成员管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为文档组实现完整的成员管理功能：成员列表、批量添加（飞书风格选择器）、修改权限、移除成员。

**Architecture:** 后端 5 个 API（成员 CRUD + 用户树），前端 3 个新组件（成员选择器、成员管理面板、组设置弹窗）+ 接入现有组详情页。数据层复用现有 `doc_group_members` 表，权限校验扩展现有 `group-permission.ts`。

**Tech Stack:** Nuxt 3 / Nitro / Prisma / Zod / Element Plus / Vue 3 Composition API

**Spec:** `docs/superpowers/specs/2026-04-16-group-member-management-design.md`

---

### Task 1: Zod Schema + 错误码 + 服务端类型

**Files:**
- Create: `server/schemas/group-member.ts`
- Create: `server/types/group-member.ts`
- Modify: `server/constants/error-codes.ts`
- Create: `tests/unit/schemas/group-member.test.ts`

- [ ] **Step 1: 编写 schema 测试**

```typescript
// tests/unit/schemas/group-member.test.ts
import { describe, it, expect } from 'vitest'
import { addMembersSchema, updateMemberRoleSchema } from '~/server/schemas/group-member'

describe('addMembersSchema', () => {
	it('接受合法的批量添加参数', () => {
		const result = addMembersSchema.safeParse({
			members: [
				{ userId: 10001, role: 3 },
				{ userId: 10002, role: 1 },
			],
		})
		expect(result.success).toBe(true)
	})

	it('接受单个成员', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: 10001, role: 2 }],
		})
		expect(result.success).toBe(true)
	})

	it('拒绝空 members 数组', () => {
		const result = addMembersSchema.safeParse({ members: [] })
		expect(result.success).toBe(false)
	})

	it('拒绝超过 50 个成员', () => {
		const members = Array.from({ length: 51 }, (_, i) => ({ userId: i + 1, role: 3 }))
		const result = addMembersSchema.safeParse({ members })
		expect(result.success).toBe(false)
	})

	it('拒绝无效 role 值', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: 10001, role: 4 }],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝 role=0', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: 10001, role: 0 }],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝负数 userId', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: -1, role: 1 }],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝小数 userId', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: 1.5, role: 1 }],
		})
		expect(result.success).toBe(false)
	})
})

describe('updateMemberRoleSchema', () => {
	it('接受合法 role', () => {
		expect(updateMemberRoleSchema.safeParse({ role: 1 }).success).toBe(true)
		expect(updateMemberRoleSchema.safeParse({ role: 2 }).success).toBe(true)
		expect(updateMemberRoleSchema.safeParse({ role: 3 }).success).toBe(true)
	})

	it('拒绝无效 role', () => {
		expect(updateMemberRoleSchema.safeParse({ role: 0 }).success).toBe(false)
		expect(updateMemberRoleSchema.safeParse({ role: 4 }).success).toBe(false)
	})

	it('拒绝缺少 role', () => {
		expect(updateMemberRoleSchema.safeParse({}).success).toBe(false)
	})
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/schemas/group-member.test.ts`
Expected: FAIL — 模块 `~/server/schemas/group-member` 不存在

- [ ] **Step 3: 实现 Zod schema**

```typescript
// server/schemas/group-member.ts
import { z } from 'zod'

const memberRoleSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])

/** 批量添加成员 */
export const addMembersSchema = z.object({
	members: z.array(z.object({
		userId: z.number().int().positive(),
		role: memberRoleSchema,
	})).min(1).max(50),
})

/** 修改成员权限 */
export const updateMemberRoleSchema = z.object({
	role: memberRoleSchema,
})

export type AddMembersBody = z.infer<typeof addMembersSchema>
export type UpdateMemberRoleBody = z.infer<typeof updateMemberRoleSchema>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/schemas/group-member.test.ts`
Expected: ALL PASS

- [ ] **Step 5: 新增错误码**

在 `server/constants/error-codes.ts` 文件末尾（`PRODUCT_LINE_HAS_GROUPS` 之后）追加：

```typescript
// ─── 组成员 ───
/** 该成员不可修改/移除（组负责人或继承成员） (403) */
export const MEMBER_IMMUTABLE = 'MEMBER_IMMUTABLE'
/** 不可移除自己 (400) */
export const MEMBER_SELF_REMOVE = 'MEMBER_SELF_REMOVE'
```

- [ ] **Step 6: 创建服务端行类型**

```typescript
// server/types/group-member.ts
/**
 * 组成员模块 — 服务端 DB 行类型
 */

/** 成员列表查询行 */
export interface MemberRow {
	id: bigint | number
	user_id: bigint | number
	name: string
	email: string | null
	avatar_url: string | null
	role: number
	source_type: number
	immutable_flag: number
	joined_at: Date
}

/** 成员校验行（修改/删除前校验） */
export interface MemberCheckRow {
	id: bigint | number
	user_id: bigint | number
	immutable_flag: number
}

/** 部门行（用户树构建） */
export interface UserTreeDeptRow {
	id: bigint | number
	name: string
	feishu_department_id: string | null
}

/** 飞书用户行（用户树构建） */
export interface UserTreeUserRow {
	user_id: bigint | number
	name: string
	email: string | null
	avatar_url: string | null
	feishu_department_ids: string | null
}

/** 已加入成员 user_id 集合查询行 */
export interface JoinedUserRow {
	user_id: bigint | number
}
```

- [ ] **Step 7: 提交**

```
feat: 组成员管理 — Zod schema、错误码、服务端类型
```

---

### Task 2: 权限工具扩展 — 组管理员可管理成员

**Files:**
- Modify: `server/utils/group-permission.ts`

- [ ] **Step 1: 新增 requireMemberPermission 函数**

在 `server/utils/group-permission.ts` 文件末尾追加：

```typescript
/**
 * 校验当前用户是否有权管理指定组的成员
 * 在 requireGroupPermission 基础上，增加：组内 role=1（管理员）也可管理成员
 */
export async function requireMemberPermission(
	event: H3Event,
	group: GroupScope & { groupId: number },
): Promise<ReturnType<typeof fail> | null> {
	// 先走原有的组权限校验（super_admin / scope角色 / owner）
	const denied = await requireGroupPermission(event, group)
	if (!denied) return null

	// 额外判断：组内管理员
	const userId = event.context.user?.id
	if (!userId) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const memberRole = await prisma.doc_group_members.findFirst({
		where: {
			group_id: BigInt(group.groupId),
			user_id: BigInt(userId),
			role: 1,
			deleted_at: null,
		},
		select: { id: true },
	})

	if (memberRole) return null

	return fail(event, 403, PERMISSION_DENIED, '无操作权限')
}
```

- [ ] **Step 2: 提交**

```
feat: 组成员管理 — 扩展权限校验支持组管理员
```

---

### Task 3: GET /api/groups/:id/members — 成员列表

**Files:**
- Create: `server/api/groups/[id]/members/index.get.ts`

- [ ] **Step 1: 实现成员列表接口**

```typescript
// server/api/groups/[id]/members/index.get.ts
/**
 * GET /api/groups/:id/members
 * 获取组成员列表
 */
import { prisma } from '~/server/utils/prisma'
import { GROUP_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'
import type { MemberRow } from '~/server/types/group-member'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	// 校验组存在
	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const rows = await prisma.$queryRaw<MemberRow[]>`
		SELECT
			gm.id, gm.user_id, u.name, u.email, u.avatar_url,
			gm.role, gm.source_type, gm.immutable_flag, gm.joined_at
		FROM doc_group_members gm
		JOIN doc_users u ON u.id = gm.user_id
		WHERE gm.group_id = ${id} AND gm.deleted_at IS NULL
		ORDER BY gm.immutable_flag DESC, gm.role ASC, gm.joined_at ASC
	`

	const members = rows.map(r => ({
		id: Number(r.id),
		userId: Number(r.user_id),
		name: r.name,
		email: r.email,
		avatar: r.avatar_url,
		role: r.role,
		sourceType: r.source_type,
		immutableFlag: r.immutable_flag,
		joinedAt: r.joined_at.getTime(),
	}))

	return ok(members)
})
```

- [ ] **Step 2: 提交**

```
feat: 组成员管理 — GET /api/groups/:id/members 成员列表接口
```

---

### Task 4: POST /api/groups/:id/members — 批量添加成员

**Files:**
- Create: `server/api/groups/[id]/members/index.post.ts`

- [ ] **Step 1: 实现批量添加接口**

```typescript
// server/api/groups/[id]/members/index.post.ts
/**
 * POST /api/groups/:id/members
 * 批量添加组成员
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { addMembersSchema } from '~/server/schemas/group-member'
import { GROUP_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const body = await readValidatedBody(event, addMembersSchema.parse)
	const userId = event.context.user!.id

	// 校验组存在 + 权限
	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireMemberPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
		groupId: id,
	})
	if (denied) return denied

	// 查询已存在的成员
	const existingMembers = await prisma.doc_group_members.findMany({
		where: {
			group_id: BigInt(id),
			user_id: { in: body.members.map(m => BigInt(m.userId)) },
			deleted_at: null,
		},
		select: { user_id: true },
	})
	const existingUserIds = new Set(existingMembers.map(m => Number(m.user_id)))

	// 过滤出需要新增的成员
	const toAdd = body.members.filter(m => !existingUserIds.has(m.userId))

	if (toAdd.length > 0) {
		await prisma.doc_group_members.createMany({
			data: toAdd.map(m => ({
				id: generateId(),
				group_id: BigInt(id),
				user_id: BigInt(m.userId),
				role: m.role,
				source_type: 1,
				immutable_flag: 0,
				created_by: BigInt(userId),
			})),
		})
	}

	return ok(
		{ added: toAdd.length, skipped: body.members.length - toAdd.length },
		toAdd.length > 0 ? `已添加 ${toAdd.length} 名成员` : '所选成员已在组内',
	)
})
```

- [ ] **Step 2: 提交**

```
feat: 组成员管理 — POST /api/groups/:id/members 批量添加接口
```

---

### Task 5: PUT + DELETE — 修改权限 / 移除成员

**Files:**
- Create: `server/api/groups/[id]/members/[memberId].put.ts`
- Create: `server/api/groups/[id]/members/[memberId].delete.ts`

- [ ] **Step 1: 实现修改权限接口**

```typescript
// server/api/groups/[id]/members/[memberId].put.ts
/**
 * PUT /api/groups/:id/members/:memberId
 * 修改成员权限
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { updateMemberRoleSchema } from '~/server/schemas/group-member'
import { GROUP_NOT_FOUND, INVALID_PARAMS, MEMBER_IMMUTABLE } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const groupId = Number(getRouterParam(event, 'id'))
	const memberId = Number(getRouterParam(event, 'memberId'))
	if (!groupId || isNaN(groupId) || !memberId || isNaN(memberId)) {
		return fail(event, 400, INVALID_PARAMS, '无效的参数')
	}

	const body = await readValidatedBody(event, updateMemberRoleSchema.parse)

	// 校验组存在 + 权限
	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(groupId), deleted_at: null },
		select: { id: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireMemberPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
		groupId,
	})
	if (denied) return denied

	// 校验成员存在 + immutable
	const member = await prisma.doc_group_members.findFirst({
		where: { id: BigInt(memberId), group_id: BigInt(groupId), deleted_at: null },
		select: { id: true, user_id: true, immutable_flag: true },
	})
	if (!member) return fail(event, 404, INVALID_PARAMS, '成员不存在')
	if (member.immutable_flag === 1) {
		return fail(event, 403, MEMBER_IMMUTABLE, '该成员权限不可修改')
	}

	await prisma.doc_group_members.update({
		where: { id: BigInt(memberId) },
		data: { role: body.role },
	})

	return ok(null, '权限已更新')
})
```

- [ ] **Step 2: 实现移除成员接口**

```typescript
// server/api/groups/[id]/members/[memberId].delete.ts
/**
 * DELETE /api/groups/:id/members/:memberId
 * 移除组成员（软删除）
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { GROUP_NOT_FOUND, INVALID_PARAMS, MEMBER_IMMUTABLE, MEMBER_SELF_REMOVE } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const groupId = Number(getRouterParam(event, 'id'))
	const memberId = Number(getRouterParam(event, 'memberId'))
	if (!groupId || isNaN(groupId) || !memberId || isNaN(memberId)) {
		return fail(event, 400, INVALID_PARAMS, '无效的参数')
	}

	const userId = event.context.user!.id

	// 校验组存在 + 权限
	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(groupId), deleted_at: null },
		select: { id: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireMemberPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
		groupId,
	})
	if (denied) return denied

	// 校验成员存在
	const member = await prisma.doc_group_members.findFirst({
		where: { id: BigInt(memberId), group_id: BigInt(groupId), deleted_at: null },
		select: { id: true, user_id: true, immutable_flag: true },
	})
	if (!member) return fail(event, 404, INVALID_PARAMS, '成员不存在')

	if (member.immutable_flag === 1) {
		return fail(event, 403, MEMBER_IMMUTABLE, '该成员不可移除')
	}

	if (Number(member.user_id) === userId) {
		return fail(event, 400, MEMBER_SELF_REMOVE, '不可移除自己')
	}

	await prisma.doc_group_members.update({
		where: { id: BigInt(memberId) },
		data: { deleted_at: new Date() },
	})

	return ok(null, '成员已移除')
})
```

- [ ] **Step 3: 提交**

```
feat: 组成员管理 — PUT/DELETE 修改权限和移除成员接口
```

---

### Task 6: GET /api/users/tree — 部门+用户树

**Files:**
- Create: `server/api/users/tree.get.ts`

- [ ] **Step 1: 实现用户树接口**

数据关联路径：`doc_departments.feishu_department_id` ↔ `doc_feishu_users.feishu_department_ids`（JSON 数组），`doc_feishu_users.feishu_open_id` ↔ `doc_users.feishu_open_id`。

```typescript
// server/api/users/tree.get.ts
/**
 * GET /api/users/tree
 * 返回部门列表 + 部门下用户（供成员选择器使用）
 * 数据来源：本地已同步的 doc_departments + doc_feishu_users + doc_users
 *
 * Query:
 *   groupId (可选) — 传入时标记已是该组成员的用户
 */
import { prisma } from '~/server/utils/prisma'
import type { UserTreeDeptRow, UserTreeUserRow, JoinedUserRow } from '~/server/types/group-member'

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const groupId = query.groupId ? Number(query.groupId) : null

	// 1. 获取所有活跃部门
	const departments = await prisma.$queryRaw<UserTreeDeptRow[]>`
		SELECT id, name, feishu_department_id
		FROM doc_departments
		WHERE deleted_at IS NULL AND status = 1
		ORDER BY name ASC
	`

	// 2. 获取所有活跃用户（doc_users JOIN doc_feishu_users）
	const users = await prisma.$queryRaw<UserTreeUserRow[]>`
		SELECT
			u.id AS user_id, u.name, u.email, u.avatar_url,
			fu.feishu_department_ids
		FROM doc_users u
		JOIN doc_feishu_users fu ON fu.feishu_open_id = u.feishu_open_id AND fu.status = 'normal'
		WHERE u.deleted_at IS NULL AND u.status = 1
		ORDER BY u.name ASC
	`

	// 3. 如有 groupId，查询已加入的 user_id 集合
	const joinedUserIds = new Set<number>()
	if (groupId) {
		const joined = await prisma.$queryRaw<JoinedUserRow[]>`
			SELECT user_id FROM doc_group_members
			WHERE group_id = ${groupId} AND deleted_at IS NULL
		`
		for (const row of joined) {
			joinedUserIds.add(Number(row.user_id))
		}
	}

	// 4. 构建部门 → 用户映射
	const deptFeishuIdMap = new Map<string, { id: number; name: string }>()
	for (const dept of departments) {
		if (dept.feishu_department_id) {
			deptFeishuIdMap.set(dept.feishu_department_id, {
				id: Number(dept.id),
				name: dept.name,
			})
		}
	}

	// 5. 将用户归入各部门
	const deptMembersMap = new Map<number, Array<{
		id: number
		name: string
		email: string | null
		avatar: string | null
		joined: boolean
	}>>()

	// 初始化每个部门
	for (const dept of departments) {
		deptMembersMap.set(Number(dept.id), [])
	}

	for (const u of users) {
		let deptIds: string[] = []
		try {
			deptIds = u.feishu_department_ids ? JSON.parse(u.feishu_department_ids as string) : []
		} catch {
			deptIds = []
		}

		const userObj = {
			id: Number(u.user_id),
			name: u.name,
			email: u.email,
			avatar: u.avatar_url,
			joined: joinedUserIds.has(Number(u.user_id)),
		}

		for (const feishuDeptId of deptIds) {
			const dept = deptFeishuIdMap.get(feishuDeptId)
			if (dept) {
				deptMembersMap.get(dept.id)?.push(userObj)
			}
		}
	}

	// 6. 组装响应
	const result = departments.map(dept => {
		const deptId = Number(dept.id)
		const members = deptMembersMap.get(deptId) || []
		return {
			id: deptId,
			name: dept.name,
			memberCount: members.length,
			members,
		}
	})

	return ok({ departments: result })
})
```

- [ ] **Step 2: 提交**

```
feat: 组成员管理 — GET /api/users/tree 部门用户树接口
```

---

### Task 7: 前端类型 + API 封装

**Files:**
- Create: `types/group-member.ts`
- Create: `api/group-members.ts`

- [ ] **Step 1: 创建前端类型**

```typescript
// types/group-member.ts
/**
 * 组成员管理 — 前端类型
 */

// 从 Zod schema 推导请求类型
export type { AddMembersBody, UpdateMemberRoleBody } from '~/server/schemas/group-member'

/** 成员列表项 */
export interface GroupMember {
	id: number
	userId: number
	name: string
	email: string | null
	avatar: string | null
	role: 1 | 2 | 3
	sourceType: 1 | 2 | 3
	immutableFlag: 0 | 1
	joinedAt: number
}

/** 成员选择器 — 部门节点 */
export interface DeptTreeNode {
	id: number
	name: string
	memberCount: number
	members: DeptTreeMember[]
}

/** 成员选择器 — 部门下用户 */
export interface DeptTreeMember {
	id: number
	name: string
	email: string | null
	avatar: string | null
	joined: boolean
}

/** 成员选择器 — 选中结果 */
export interface SelectedUser {
	id: number
	name: string
	avatar: string | null
}

/** 成员角色标签映射 */
export const MEMBER_ROLE_MAP: Record<number, string> = {
	1: '管理员',
	2: '可编辑',
	3: '上传下载',
}

/** 成员来源标签映射 */
export const MEMBER_SOURCE_MAP: Record<number, string> = {
	1: '手动添加',
	2: '飞书同步',
	3: '继承',
}
```

- [ ] **Step 2: 创建 API 封装**

```typescript
// api/group-members.ts
import type { ApiResult } from '~/types/api'
import type { GroupMember, AddMembersBody, UpdateMemberRoleBody, DeptTreeNode } from '~/types/group-member'

/** 获取组成员列表 */
export function apiGetGroupMembers(groupId: number) {
	return useAuthFetch<ApiResult<GroupMember[]>>(`/api/groups/${groupId}/members`)
}

/** 批量添加成员 */
export function apiAddGroupMembers(groupId: number, body: AddMembersBody) {
	return useAuthFetch<ApiResult<{ added: number; skipped: number }>>(`/api/groups/${groupId}/members`, {
		method: 'POST',
		body,
	})
}

/** 修改成员权限 */
export function apiUpdateMemberRole(groupId: number, memberId: number, body: UpdateMemberRoleBody) {
	return useAuthFetch<ApiResult>(`/api/groups/${groupId}/members/${memberId}`, {
		method: 'PUT',
		body,
	})
}

/** 移除成员 */
export function apiRemoveMember(groupId: number, memberId: number) {
	return useAuthFetch<ApiResult>(`/api/groups/${groupId}/members/${memberId}`, {
		method: 'DELETE',
	})
}

/** 获取部门用户树（成员选择器数据源） */
export function apiGetUserTree(groupId?: number) {
	const query = groupId ? `?groupId=${groupId}` : ''
	return useAuthFetch<ApiResult<{ departments: DeptTreeNode[] }>>(`/api/users/tree${query}`)
}
```

- [ ] **Step 3: 提交**

```
feat: 组成员管理 — 前端类型定义和API封装
```

---

### Task 8: GroupMemberPanel.vue — 成员管理面板

**Files:**
- Create: `components/GroupMemberPanel.vue`

- [ ] **Step 1: 实现成员管理面板**

```vue
<!-- components/GroupMemberPanel.vue -->
<template>
	<div class="gm-panel">
		<div class="gm-panel__header">
			<span class="gm-panel__count">共 {{ members.length }} 人</span>
			<el-button type="primary" size="small" @click="$emit('invite')">
				<el-icon :size="14"><Plus /></el-icon>
				邀请成员
			</el-button>
		</div>

		<el-table :data="members" v-loading="loading" class="df-data-table" style="width: 100%">
			<el-table-column label="成员" min-width="180">
				<template #default="{ row }">
					<div class="gm-panel__user">
						<img
							v-if="row.avatar" class="gm-panel__avatar" :src="row.avatar"
							@error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'" />
						<span v-else class="gm-panel__avatar gm-panel__avatar--text">{{ row.name?.slice(0, 1) }}</span>
						<span>{{ row.name }}</span>
					</div>
				</template>
			</el-table-column>

			<el-table-column label="邮箱" prop="email" min-width="200" show-overflow-tooltip />

			<el-table-column label="权限" width="150">
				<template #default="{ row }">
					<el-select
						:model-value="row.role"
						:disabled="row.immutableFlag === 1"
						size="small"
						@change="(val: number) => onRoleChange(row, val)">
						<el-option :value="1" label="管理员" />
						<el-option :value="2" label="可编辑" />
						<el-option :value="3" label="上传下载" />
					</el-select>
				</template>
			</el-table-column>

			<el-table-column label="来源" width="140">
				<template #default="{ row }">
					<el-tag
						v-if="row.immutableFlag === 1"
						type="danger" size="small" effect="plain" round>
						组负责人
					</el-tag>
					<el-tag
						v-else-if="row.sourceType === 2"
						size="small" effect="plain" round>
						飞书同步
					</el-tag>
					<el-tag
						v-else
						type="info" size="small" effect="plain" round>
						手动添加
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column label="操作" width="80" align="center">
				<template #default="{ row }">
					<el-button
						v-if="row.immutableFlag !== 1"
						type="danger" text size="small"
						:loading="removingId === row.id"
						@click="onRemove(row)">
						移除
					</el-button>
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { GroupMember } from '~/types/group-member'
import { apiGetGroupMembers, apiUpdateMemberRole, apiRemoveMember } from '~/api/group-members'

const props = defineProps<{
	groupId: number
}>()

const emit = defineEmits<{
	invite: []
}>()

const loading = ref(false)
const members = ref<GroupMember[]>([])
const removingId = ref<number | null>(null)

async function loadMembers() {
	loading.value = true
	try {
		const res = await apiGetGroupMembers(props.groupId)
		if (res.success) {
			members.value = res.data
		}
	} finally {
		loading.value = false
	}
}

async function onRoleChange(member: GroupMember, newRole: number) {
	const res = await apiUpdateMemberRole(props.groupId, member.id, { role: newRole as 1 | 2 | 3 })
	if (res.success) {
		msgSuccess(res.message || '权限已更新')
		member.role = newRole as 1 | 2 | 3
	} else {
		msgError(res.message || '操作失败')
		// 回滚 — 重新加载
		await loadMembers()
	}
}

async function onRemove(member: GroupMember) {
	try {
		await ElMessageBox.confirm(
			`确定移除成员「${member.name}」吗？移除后该成员将无法访问此组的文件。`,
			'移除成员',
			{ confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
		)
	} catch {
		return // 取消
	}

	removingId.value = member.id
	try {
		const res = await apiRemoveMember(props.groupId, member.id)
		if (res.success) {
			msgSuccess(res.message || '成员已移除')
			members.value = members.value.filter(m => m.id !== member.id)
		} else {
			msgError(res.message || '操作失败')
		}
	} finally {
		removingId.value = null
	}
}

// 暴露刷新方法供父组件调用
function refresh() {
	loadMembers()
}

defineExpose({ refresh })

watch(() => props.groupId, () => loadMembers(), { immediate: true })
</script>
```

- [ ] **Step 2: 提交**

```
feat: 组成员管理 — GroupMemberPanel 成员管理面板组件
```

---

### Task 9: MemberSelectorModal.vue — 飞书风格成员选择器

**Files:**
- Create: `components/MemberSelectorModal.vue`

- [ ] **Step 1: 实现成员选择器弹窗**

```vue
<!-- components/MemberSelectorModal.vue -->
<template>
	<el-dialog
		class="df-modal df-member-selector-modal"
		:model-value="visible"
		title="选择成员"
		width="680px"
		:close-on-click-modal="false"
		destroy-on-close
		@close="close">
		<div class="ms-body">
			<!-- 左栏：导航 + 列表 -->
			<div class="ms-left">
				<el-input
					v-model="searchKeyword" placeholder="搜索用户" clearable size="default"
					class="ms-search" />

				<!-- 面包屑 -->
				<div class="ms-breadcrumb">
					<span class="ms-breadcrumb__item ms-breadcrumb__link" @click="goBack">
						组织架构
					</span>
					<template v-if="currentDept">
						<span class="ms-breadcrumb__sep">&gt;</span>
						<span class="ms-breadcrumb__item">{{ currentDept.name }}</span>
					</template>
				</div>

				<el-scrollbar class="ms-list-scroll">
					<!-- 搜索模式：全局搜索结果 -->
					<template v-if="searchKeyword">
						<div
							v-for="user in filteredSearchUsers" :key="user.id"
							class="ms-item"
							:class="{ 'ms-item--disabled': user.joined || isExcluded(user.id) }"
							@click="toggleUser(user)">
							<el-checkbox
								:model-value="isSelected(user.id)"
								:disabled="user.joined || isExcluded(user.id)"
								@click.stop @change="toggleUser(user)" />
							<span class="ms-item__avatar ms-item__avatar--text">{{ user.name?.slice(0, 1) }}</span>
							<span class="ms-item__name">{{ user.name }}</span>
							<span v-if="user.joined" class="ms-item__tag">已加入</span>
						</div>
						<div v-if="filteredSearchUsers.length === 0" class="ms-empty">无匹配用户</div>
					</template>

					<!-- 部门列表模式 -->
					<template v-else-if="!currentDept">
						<div
							v-for="dept in departments" :key="dept.id"
							class="ms-item ms-item--dept"
							@click="enterDept(dept)">
							<el-icon :size="16"><OfficeBuilding /></el-icon>
							<span class="ms-item__name">{{ dept.name }}</span>
							<span class="ms-item__count">{{ dept.memberCount }}</span>
							<el-icon :size="12"><ArrowRight /></el-icon>
						</div>
					</template>

					<!-- 部门内成员模式 -->
					<template v-else>
						<div
							v-for="user in filteredDeptMembers" :key="user.id"
							class="ms-item"
							:class="{ 'ms-item--disabled': user.joined || isExcluded(user.id) }"
							@click="toggleUser(user)">
							<el-checkbox
								:model-value="isSelected(user.id)"
								:disabled="user.joined || isExcluded(user.id)"
								@click.stop @change="toggleUser(user)" />
							<span class="ms-item__avatar ms-item__avatar--text">{{ user.name?.slice(0, 1) }}</span>
							<span class="ms-item__name">{{ user.name }}</span>
							<span v-if="user.joined" class="ms-item__tag">已加入</span>
						</div>
						<div v-if="filteredDeptMembers.length === 0" class="ms-empty">该部门暂无成员</div>
					</template>
				</el-scrollbar>
			</div>

			<!-- 右栏：已选 -->
			<div class="ms-right">
				<div class="ms-right__title">已选：{{ selectedUsers.length }} 个</div>
				<el-scrollbar class="ms-right__list">
					<div v-for="user in selectedUsers" :key="user.id" class="ms-selected-item">
						<span>{{ user.name }}</span>
						<el-icon class="ms-selected-item__remove" @click="removeSelected(user.id)"><Close /></el-icon>
					</div>
				</el-scrollbar>
			</div>
		</div>

		<template #footer>
			<div class="ms-footer">
				<div class="ms-footer__role">
					<span>权限：</span>
					<el-select v-model="selectedRole" size="small" style="width: 120px">
						<el-option :value="1" label="管理员" />
						<el-option :value="2" label="可编辑" />
						<el-option :value="3" label="上传下载" />
					</el-select>
				</div>
				<div class="ms-footer__actions">
					<el-button @click="close">取消</el-button>
					<el-button type="primary" :disabled="selectedUsers.length === 0" @click="handleConfirm">确认</el-button>
				</div>
			</div>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { OfficeBuilding, ArrowRight, Close } from '@element-plus/icons-vue'
import type { DeptTreeNode, DeptTreeMember, SelectedUser } from '~/types/group-member'
import { apiGetUserTree } from '~/api/group-members'

const props = withDefaults(defineProps<{
	visible: boolean
	groupId?: number
	multiple?: boolean
	excludeUserIds?: number[]
}>(), {
	multiple: true,
	excludeUserIds: () => [],
})

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'confirm': [users: SelectedUser[], role: number]
}>()

const departments = ref<DeptTreeNode[]>([])
const currentDept = ref<DeptTreeNode | null>(null)
const searchKeyword = ref('')
const selectedUsers = ref<SelectedUser[]>([])
const selectedRole = ref<number>(3) // 默认上传下载
const treeLoading = ref(false)

// 所有用户（扁平化，用于全局搜索）
const allUsers = computed(() => {
	const users = new Map<number, DeptTreeMember>()
	for (const dept of departments.value) {
		for (const m of dept.members) {
			if (!users.has(m.id)) users.set(m.id, m)
		}
	}
	return Array.from(users.values())
})

// 全局搜索过滤
const filteredSearchUsers = computed(() => {
	const kw = searchKeyword.value.trim().toLowerCase()
	if (!kw) return []
	return allUsers.value.filter(u => u.name.toLowerCase().includes(kw))
})

// 当前部门内成员（无搜索时使用）
const filteredDeptMembers = computed(() => {
	return currentDept.value?.members || []
})

function isSelected(userId: number) {
	return selectedUsers.value.some(u => u.id === userId)
}

function isExcluded(userId: number) {
	return props.excludeUserIds.includes(userId)
}

function toggleUser(user: DeptTreeMember) {
	if (user.joined || isExcluded(user.id)) return

	if (isSelected(user.id)) {
		selectedUsers.value = selectedUsers.value.filter(u => u.id !== user.id)
	} else {
		if (!props.multiple) {
			selectedUsers.value = [{ id: user.id, name: user.name, avatar: user.avatar }]
		} else {
			selectedUsers.value.push({ id: user.id, name: user.name, avatar: user.avatar })
		}
	}
}

function removeSelected(userId: number) {
	selectedUsers.value = selectedUsers.value.filter(u => u.id !== userId)
}

function enterDept(dept: DeptTreeNode) {
	currentDept.value = dept
}

function goBack() {
	currentDept.value = null
}

function close() {
	emit('update:visible', false)
}

function handleConfirm() {
	emit('confirm', [...selectedUsers.value], selectedRole.value)
	close()
}

async function loadTree() {
	treeLoading.value = true
	try {
		const res = await apiGetUserTree(props.groupId)
		if (res.success) {
			departments.value = res.data.departments
		}
	} finally {
		treeLoading.value = false
	}
}

// 打开时加载数据、重置状态
watch(() => props.visible, (val) => {
	if (val) {
		selectedUsers.value = []
		selectedRole.value = 3
		searchKeyword.value = ''
		currentDept.value = null
		loadTree()
	}
})
</script>
```

- [ ] **Step 2: 添加样式到 `assets/styles/components/_modals.scss`**

在文件末尾追加：

```scss
/* ── 成员选择器弹窗 ── */
.el-dialog.df-member-selector-modal {
	.el-dialog__body {
		padding: 0;
	}
}

.ms-body {
	display: flex;
	height: 420px;
	border-top: 1px solid var(--df-border);
	border-bottom: 1px solid var(--df-border);
}

.ms-left {
	flex: 1;
	display: flex;
	flex-direction: column;
	border-right: 1px solid var(--df-border);
}

.ms-search {
	margin: 12px 12px 0;
}

.ms-breadcrumb {
	padding: 10px 14px;
	font-size: 12px;
	color: var(--df-subtext);
	display: flex;
	align-items: center;
	gap: 4px;
}

.ms-breadcrumb__link {
	color: var(--df-primary);
	cursor: pointer;

	&:hover {
		text-decoration: underline;
	}
}

.ms-breadcrumb__sep {
	color: var(--df-subtext);
}

.ms-list-scroll {
	flex: 1;
}

.ms-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 14px;
	cursor: pointer;
	font-size: 14px;
	transition: background 0.15s;

	&:hover {
		background: var(--df-surface);
	}

	&--dept {
		.el-icon:last-child {
			margin-left: auto;
			color: var(--df-subtext);
		}
	}

	&--disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.ms-item__avatar {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	object-fit: cover;
	flex-shrink: 0;

	&--text {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--df-primary), #818cf8);
		color: #fff;
		font-size: 12px;
		font-weight: 600;
	}
}

.ms-item__name {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ms-item__count {
	font-size: 12px;
	color: var(--df-subtext);
}

.ms-item__tag {
	font-size: 11px;
	color: var(--df-subtext);
	margin-left: auto;
}

.ms-empty {
	padding: 40px 0;
	text-align: center;
	color: var(--df-subtext);
	font-size: 13px;
}

.ms-right {
	width: 220px;
	display: flex;
	flex-direction: column;
}

.ms-right__title {
	padding: 12px 14px;
	font-size: 13px;
	font-weight: 500;
	color: var(--df-text);
}

.ms-right__list {
	flex: 1;
}

.ms-selected-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 6px 14px;
	font-size: 13px;
}

.ms-selected-item__remove {
	cursor: pointer;
	color: var(--df-subtext);
	transition: color 0.15s;

	&:hover {
		color: var(--el-color-danger);
	}
}

.ms-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.ms-footer__role {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 13px;
	color: var(--df-text);
}

.ms-footer__actions {
	display: flex;
	gap: 8px;
}
```

- [ ] **Step 3: 提交**

```
feat: 组成员管理 — MemberSelectorModal 飞书风格成员选择器
```

---

### Task 10: GroupSettingsModal.vue — 组设置弹窗

**Files:**
- Create: `components/GroupSettingsModal.vue`

- [ ] **Step 1: 实现组设置弹窗**

```vue
<!-- components/GroupSettingsModal.vue -->
<template>
	<el-dialog
		class="df-modal"
		:model-value="visible"
		:title="`「${groupName}」设置`"
		width="780px"
		:close-on-click-modal="false"
		destroy-on-close
		@close="close">
		<el-tabs v-model="activeTab">
			<el-tab-pane label="审批流配置" name="approval">
				<div class="gs-placeholder">
					<el-empty description="审批流配置即将上线" :image-size="100" />
				</div>
			</el-tab-pane>

			<el-tab-pane label="成员管理" name="members">
				<GroupMemberPanel ref="memberPanelRef" :group-id="groupId" @invite="openMemberSelector" />
			</el-tab-pane>

			<el-tab-pane label="基本设置" name="basic">
				<el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="gs-basic-form">
					<el-form-item label="组名称" prop="name">
						<el-input v-model="form.name" maxlength="150" show-word-limit />
					</el-form-item>

					<el-form-item label="归属层级">
						<el-input :model-value="scopeLabel" readonly />
					</el-form-item>

					<el-form-item label="描述" prop="description">
						<el-input v-model="form.description" type="textarea" maxlength="500" show-word-limit :rows="3" />
					</el-form-item>

					<el-form-item label="创建时间">
						<el-input :model-value="createdAtText" readonly />
					</el-form-item>

					<el-form-item>
						<el-button type="primary" :loading="saving" @click="handleSaveBasic">保存</el-button>
					</el-form-item>

					<el-divider />

					<el-form-item>
						<el-button type="danger" plain @click="handleDeleteGroup">删除组</el-button>
					</el-form-item>
				</el-form>
			</el-tab-pane>
		</el-tabs>

		<!-- 成员选择器 -->
		<MemberSelectorModal
			v-model:visible="selectorVisible"
			:group-id="groupId"
			@confirm="onMembersSelected" />
	</el-dialog>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import type { GroupDetail } from '~/types/group'
import type { SelectedUser } from '~/types/group-member'
import { apiUpdateGroup, apiDeleteGroup } from '~/api/groups'
import { apiAddGroupMembers } from '~/api/group-members'
import { formatTime } from '~/utils/format'

const props = defineProps<{
	visible: boolean
	groupId: number
	groupName: string
	group?: GroupDetail
}>()

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'success': []
}>()

const activeTab = ref('members')
const selectorVisible = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const memberPanelRef = ref<{ refresh: () => void } | null>(null)

const form = ref({ name: '', description: '' })

const rules: FormRules = {
	name: [{ required: true, message: '请输入组名称', trigger: 'blur' }],
}

const scopeLabel = computed(() => {
	if (!props.group) return ''
	const map: Record<number, string> = { 1: '公司层', 2: '按部门', 3: '按产品线' }
	return map[props.group.scopeType] || ''
})

const createdAtText = computed(() => {
	if (!props.group?.createdAt) return ''
	return formatTime(props.group.createdAt, 'YYYY-MM-DD')
})

watch(() => props.visible, (val) => {
	if (val && props.group) {
		form.value.name = props.group.name
		form.value.description = props.group.description ?? ''
		activeTab.value = 'members'
	}
})

function close() {
	emit('update:visible', false)
}

function openMemberSelector() {
	selectorVisible.value = true
}

async function onMembersSelected(users: SelectedUser[], role: number) {
	if (users.length === 0) return

	const res = await apiAddGroupMembers(props.groupId, {
		members: users.map(u => ({ userId: u.id, role: role as 1 | 2 | 3 })),
	})

	if (res.success) {
		msgSuccess(res.message || '成员已添加')
		memberPanelRef.value?.refresh()
	} else {
		msgError(res.message || '添加失败')
	}
}

async function handleSaveBasic() {
	const valid = await formRef.value?.validate().catch(() => false)
	if (!valid) return

	saving.value = true
	try {
		const res = await apiUpdateGroup(props.groupId, {
			name: form.value.name,
			description: form.value.description || undefined,
		})
		if (res.success) {
			msgSuccess(res.message || '保存成功')
			emit('success')
		} else {
			msgError(res.message || '保存失败')
		}
	} catch {
		msgError('保存失败')
	} finally {
		saving.value = false
	}
}

async function handleDeleteGroup() {
	try {
		await ElMessageBox.confirm(
			'确定删除该组吗？组下有文件时不可删除。',
			'删除组',
			{ confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
		)
	} catch {
		return
	}

	const res = await apiDeleteGroup(props.groupId)
	if (res.success) {
		msgSuccess(res.message || '组已删除')
		emit('success')
		close()
	} else {
		msgError(res.message || '删除失败')
	}
}
</script>
```

- [ ] **Step 2: 提交**

```
feat: 组成员管理 — GroupSettingsModal 组设置弹窗（成员管理+基本设置）
```

---

### Task 11: 接入主页面

**Files:**
- Modify: `pages/docs/index.vue`

- [ ] **Step 1: 在 pages/docs/index.vue 中接入 GroupSettingsModal**

在 template 中，`<ProductLineFormModal>` 之后添加：

```vue
<GroupSettingsModal
	v-model:visible="settingsModalVisible"
	:group-id="settingsModalGroupId"
	:group-name="settingsModalGroupName"
	:group="settingsModalGroup"
	@success="refreshTree" />
```

在 script 中，替换 `onGroupSettings` 函数及新增相关状态：

```typescript
// ── GroupSettingsModal state ──
const settingsModalVisible = ref(false)
const settingsModalGroupId = ref(0)
const settingsModalGroupName = ref('')
const settingsModalGroup = ref<GroupDetail | undefined>()

function onGroupSettings() {
	const data = selectedData.value
	if (!data?.id) return
	settingsModalGroupId.value = typeof data.id === 'number' ? data.id : Number(data.id)
	settingsModalGroupName.value = data.name || ''
	settingsModalGroup.value = data as GroupDetail
	settingsModalVisible.value = true
}
```

需要在 imports 区域添加 `GroupDetail` 类型导入：

```typescript
import type { GroupDetail } from '~/types/group'
```

- [ ] **Step 2: 验证接入**

Run: `npm run dev`

在浏览器中：
1. 进入共享文档页，选中一个组
2. 点击右侧面板的「设置」按钮
3. 确认弹出组设置弹窗，默认在「成员管理」Tab
4. 确认成员列表正确加载
5. 点击「邀请成员」确认选择器弹窗打开
6. 切换到「基本设置」Tab，确认表单正确显示

- [ ] **Step 3: 提交**

```
feat: 组成员管理 — 接入共享文档页面，组设置功能完整可用
```

---

### Task 12: 样式调整 + 面板样式

**Files:**
- Modify: `assets/styles/components/_modals.scss`（Task 9 已添加选择器样式）

- [ ] **Step 1: 检查并补充组设置弹窗样式**

确认 `_modals.scss` 中已有的 `.df-modal` 样式覆盖 GroupSettingsModal。如需补充，追加：

```scss
/* ── 组设置弹窗 ── */
.gs-placeholder {
	padding: 60px 0;
}

.gs-basic-form {
	max-width: 480px;
}
```

成员管理面板样式追加：

```scss
/* ── 成员管理面板 ── */
.gm-panel__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16px;
}

.gm-panel__count {
	font-size: 14px;
	color: var(--df-subtext);
}

.gm-panel__user {
	display: flex;
	align-items: center;
	gap: 10px;
}

.gm-panel__avatar {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	object-fit: cover;
	flex-shrink: 0;

	&--text {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--df-primary), #818cf8);
		color: #fff;
		font-size: 12px;
		font-weight: 600;
	}
}
```

- [ ] **Step 2: 提交**

```
style: 组成员管理 — 补充面板和弹窗样式
```

---

### Task 13: 更新接口文档

**Files:**
- Modify: `docs/api-auth-design.md`

- [ ] **Step 1: 在接口文档中新增组成员管理接口**

在 `docs/api-auth-design.md` 的接口总览表和详细说明中追加以下 6 个接口：

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/groups/:id/members` | 组成员列表 | JWT |
| POST | `/api/groups/:id/members` | 批量添加成员 | JWT + 组管理权限 |
| PUT | `/api/groups/:id/members/:memberId` | 修改成员权限 | JWT + 组管理权限 |
| DELETE | `/api/groups/:id/members/:memberId` | 移除成员 | JWT + 组管理权限 |
| GET | `/api/users/tree` | 部门用户树 | JWT |

在对应的详细说明区域补充每个接口的请求/响应示例，格式与文档中已有接口保持一致。

- [ ] **Step 2: 提交**

```
docs: 更新接口文档，新增组成员管理相关接口
```

---

## 文件清单汇总

### 新增文件（11 个）

| 文件 | Task |
|---|---|
| `server/schemas/group-member.ts` | 1 |
| `server/types/group-member.ts` | 1 |
| `tests/unit/schemas/group-member.test.ts` | 1 |
| `server/api/groups/[id]/members/index.get.ts` | 3 |
| `server/api/groups/[id]/members/index.post.ts` | 4 |
| `server/api/groups/[id]/members/[memberId].put.ts` | 5 |
| `server/api/groups/[id]/members/[memberId].delete.ts` | 5 |
| `server/api/users/tree.get.ts` | 6 |
| `types/group-member.ts` | 7 |
| `api/group-members.ts` | 7 |
| `components/MemberSelectorModal.vue` | 9 |

### 新增文件（含 Task 8/10 的组件）

| 文件 | Task |
|---|---|
| `components/GroupMemberPanel.vue` | 8 |
| `components/GroupSettingsModal.vue` | 10 |

### 修改文件（5 个）

| 文件 | Task | 修改内容 |
|---|---|---|
| `server/constants/error-codes.ts` | 1 | +2 错误码 |
| `server/utils/group-permission.ts` | 2 | +requireMemberPermission 函数 |
| `pages/docs/index.vue` | 11 | onGroupSettings → 打开 GroupSettingsModal |
| `assets/styles/components/_modals.scss` | 9, 12 | +选择器/面板样式 |
| `docs/api-auth-design.md` | 13 | +5 个接口文档 |
