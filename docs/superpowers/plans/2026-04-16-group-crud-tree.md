# 文档组 CRUD + 树结构 + 产品线 CRUD 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现文档组 CRUD（创建/编辑/删除/树结构展示）和产品线基础 CRUD，前端树接通真实 API 数据，替换现有 mock。

**Architecture:** 后端使用 Nitro event handlers + Prisma raw SQL + Zod 校验，遵循现有 RBAC 模块代码模式。前端使用 Vue 3 Composition API + Element Plus 组件库，新增弹窗/面板/菜单子组件拆分 `pages/docs/index.vue` 的职责。

**Tech Stack:** Nuxt 3, Nitro, Prisma (raw SQL), Zod, Vue 3, Element Plus, TypeScript

**设计文档:** `docs/superpowers/specs/2026-04-16-group-crud-tree-design.md`

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `server/utils/snowflake.ts` | 雪花 ID 生成器（doc_* 表无 AUTO_INCREMENT） |
| `server/utils/group-permission.ts` | 组操作权限校验工具 |
| `server/schemas/group.ts` | 组 Zod 校验 schema |
| `server/schemas/product-line.ts` | 产品线 Zod 校验 schema |
| `server/types/group.ts` | 组模块 DB 行类型 |
| `server/api/groups/tree.get.ts` | 组树查询接口 |
| `server/api/groups/[id].get.ts` | 组详情 |
| `server/api/groups/index.post.ts` | 创建组 |
| `server/api/groups/[id].put.ts` | 编辑组 |
| `server/api/groups/[id].delete.ts` | 删除组 |
| `server/api/product-lines/index.get.ts` | 产品线列表 |
| `server/api/product-lines/index.post.ts` | 创建产品线 |
| `server/api/product-lines/[id].put.ts` | 编辑产品线 |
| `server/api/product-lines/[id].delete.ts` | 删除产品线 |
| `api/groups.ts` | 前端组 API 封装 |
| `api/product-lines.ts` | 前端产品线 API 封装 |
| `types/group.ts` | 前端组/产品线类型 |
| `components/GroupFormModal.vue` | 组创建/编辑弹窗 |
| `components/ProductLineFormModal.vue` | 产品线创建/编辑弹窗 |
| `components/DocExplorerPanel.vue` | 右侧面板（按节点类型展示内容） |
| `components/TreeActionMenu.vue` | 树节点「更多」下拉菜单 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `server/constants/error-codes.ts` | 新增组/产品线错误码 |
| `types/doc-nav-tree.ts` | 补充 `scopeType`、`scopeRefId`、`parentId` 字段 |
| `pages/docs/index.vue` | 移除 mock 数据，接入 API 和子组件 |

---

## Task 1: 服务端基础设施（错误码 + 雪花 ID + 组权限工具）

**Files:**
- Modify: `server/constants/error-codes.ts`
- Create: `server/utils/snowflake.ts`
- Create: `server/utils/group-permission.ts`

### 1.1 新增错误码

- [ ] **Step 1:** 在 `server/constants/error-codes.ts` 末尾追加组和产品线错误码

```typescript
// ─── 文档组 ───
/** 组不存在 (404) */
export const GROUP_NOT_FOUND = 'GROUP_NOT_FOUND'
/** 同级组名称已存在 (409) */
export const GROUP_NAME_EXISTS = 'GROUP_NAME_EXISTS'
/** 父组不存在 (400) */
export const PARENT_GROUP_NOT_FOUND = 'PARENT_GROUP_NOT_FOUND'
/** 组内含文档，无法删除 (400) */
export const GROUP_HAS_DOCUMENTS = 'GROUP_HAS_DOCUMENTS'
/** 组内含子组，无法删除 (400) */
export const GROUP_HAS_CHILDREN = 'GROUP_HAS_CHILDREN'

// ─── 产品线 ───
/** 产品线不存在 (404) */
export const PRODUCT_LINE_NOT_FOUND = 'PRODUCT_LINE_NOT_FOUND'
/** 产品线名称已存在 (409) */
export const PRODUCT_LINE_NAME_EXISTS = 'PRODUCT_LINE_NAME_EXISTS'
/** 产品线下含组，无法删除 (400) */
export const PRODUCT_LINE_HAS_GROUPS = 'PRODUCT_LINE_HAS_GROUPS'
```

### 1.2 雪花 ID 生成器

- [ ] **Step 2:** 创建 `server/utils/snowflake.ts`

```typescript
/**
 * 轻量级雪花 ID 生成器
 * doc_* 表主键为 BIGINT UNSIGNED（无 AUTO_INCREMENT），需要应用层生成 ID
 *
 * 结构: 41-bit 时间戳(ms) + 12-bit 序列号 = 53 bit
 * 可安全表示为 JS Number（Number.MAX_SAFE_INTEGER = 2^53 - 1）
 * 自定义纪元: 2026-01-01 00:00:00 UTC，可用约 69 年
 */

const EPOCH = 1767225600000n // 2026-01-01T00:00:00Z
const SEQUENCE_BITS = 12n
const SEQUENCE_MASK = (1n << SEQUENCE_BITS) - 1n // 0xFFF

let lastTimestamp = 0n
let sequence = 0n

export function generateId(): bigint {
	let ts = BigInt(Date.now()) - EPOCH

	if (ts === lastTimestamp) {
		sequence = (sequence + 1n) & SEQUENCE_MASK
		// 同一毫秒内序列溢出，等待下一毫秒
		if (sequence === 0n) {
			while (ts <= lastTimestamp) {
				ts = BigInt(Date.now()) - EPOCH
			}
		}
	} else {
		sequence = 0n
	}

	lastTimestamp = ts
	return (ts << SEQUENCE_BITS) | sequence
}
```

### 1.3 组权限校验工具

- [ ] **Step 3:** 创建 `server/utils/group-permission.ts`

```typescript
/**
 * 文档组操作权限校验
 *
 * 规则:
 *   - super_admin: 全局通过
 *   - 公司层: company_admin 可操作
 *   - 部门层: 该部门的 dept_head 可操作
 *   - 产品线层: 该产品线的 pl_head 可操作
 *   - 组负责人 (owner_user_id): 可操作自己的组
 */
import { prisma } from '~/server/utils/prisma'
import { PERMISSION_DENIED } from '~/server/constants/error-codes'
import type { H3Event } from 'h3'

interface GroupScope {
	scopeType: number
	scopeRefId: number | null
	ownerUserId: number | null
}

/** 校验当前用户是否有权操作指定组 */
export async function requireGroupPermission(
	event: H3Event,
	group: GroupScope,
): Promise<ReturnType<typeof fail> | null> {
	const userId = event.context.user?.id
	if (!userId) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	// 组负责人直接通过
	if (group.ownerUserId && Number(group.ownerUserId) === userId) return null

	// 查询用户角色（含 scope）
	const roles = await prisma.$queryRaw<Array<{
		code: string
		scope_type: number | null
		scope_ref_id: bigint | number | null
	}>>`
		SELECT r.code, ur.scope_type, ur.scope_ref_id
		FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ur.user_id = ${userId}
	`

	// super_admin 全局通过
	if (roles.some(r => r.code === 'super_admin')) return null

	// 按 scope 校验
	const { scopeType, scopeRefId } = group
	const allowed = roles.some((r) => {
		if (scopeType === 1 && r.code === 'company_admin') return true
		if (scopeType === 2 && r.code === 'dept_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		if (scopeType === 3 && r.code === 'pl_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		return false
	})

	if (!allowed) return fail(event, 403, PERMISSION_DENIED, '无操作权限')
	return null
}

/**
 * 校验当前用户是否可在指定 scope 下创建顶级组
 * (创建子组通过 requireGroupPermission 校验父组权限)
 */
export async function requireCreateGroupPermission(
	event: H3Event,
	scopeType: number,
	scopeRefId: number | null,
): Promise<ReturnType<typeof fail> | null> {
	const userId = event.context.user?.id
	if (!userId) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const roles = await prisma.$queryRaw<Array<{
		code: string
		scope_type: number | null
		scope_ref_id: bigint | number | null
	}>>`
		SELECT r.code, ur.scope_type, ur.scope_ref_id
		FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ur.user_id = ${userId}
	`

	if (roles.some(r => r.code === 'super_admin')) return null

	const allowed = roles.some((r) => {
		if (scopeType === 1 && r.code === 'company_admin') return true
		if (scopeType === 2 && r.code === 'dept_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		if (scopeType === 3 && r.code === 'pl_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		return false
	})

	if (!allowed) return fail(event, 403, PERMISSION_DENIED, '无操作权限')
	return null
}
```

- [ ] **Step 4:** 提交

```
feat: 新增组模块基础设施（错误码、雪花ID、权限工具）
```

---

## Task 2: Zod Schema + 服务端类型

**Files:**
- Create: `server/schemas/group.ts`
- Create: `server/schemas/product-line.ts`
- Create: `server/types/group.ts`

- [ ] **Step 1:** 创建 `server/schemas/group.ts`

```typescript
import { z } from 'zod'

/** 创建组 */
export const groupCreateSchema = z.object({
	name: z.string().min(1, '组名称不能为空').max(150, '组名称最多 150 字'),
	description: z.string().max(500, '描述最多 500 字').optional(),
	scopeType: z.number().int().min(1).max(3),
	scopeRefId: z.number().int().positive().optional(),
	parentId: z.number().int().positive().optional(),
})
export type GroupCreateBody = z.infer<typeof groupCreateSchema>

/** 编辑组 */
export const groupUpdateSchema = z.object({
	name: z.string().min(1, '组名称不能为空').max(150, '组名称最多 150 字').optional(),
	description: z.string().max(500, '描述最多 500 字').optional(),
})
export type GroupUpdateBody = z.infer<typeof groupUpdateSchema>
```

- [ ] **Step 2:** 创建 `server/schemas/product-line.ts`

```typescript
import { z } from 'zod'

/** 创建产品线 */
export const productLineCreateSchema = z.object({
	name: z.string().min(1, '产品线名称不能为空').max(150, '产品线名称最多 150 字'),
	description: z.string().max(500, '描述最多 500 字').optional(),
})
export type ProductLineCreateBody = z.infer<typeof productLineCreateSchema>

/** 编辑产品线 */
export const productLineUpdateSchema = z.object({
	name: z.string().min(1, '产品线名称不能为空').max(150, '产品线名称最多 150 字').optional(),
	description: z.string().max(500, '描述最多 500 字').optional(),
})
export type ProductLineUpdateBody = z.infer<typeof productLineUpdateSchema>
```

- [ ] **Step 3:** 创建 `server/types/group.ts`

```typescript
/**
 * 文档组模块 — 服务端 DB 行类型
 */

/** 组查询行（树构建用） */
export interface GroupTreeRow {
	id: bigint | number
	parent_id: bigint | number | null
	scope_type: number
	scope_ref_id: bigint | number | null
	name: string
	description: string | null
	owner_user_id: bigint | number
	owner_name: string
	approval_enabled: number
	file_size_limit_mb: number
	status: number
	file_count: bigint | number
}

/** 组详情查询行 */
export interface GroupDetailRow {
	id: bigint | number
	parent_id: bigint | number | null
	scope_type: number
	scope_ref_id: bigint | number | null
	name: string
	description: string | null
	owner_user_id: bigint | number
	owner_name: string
	approval_enabled: number
	file_size_limit_mb: number
	allowed_file_types: string | null
	file_name_regex: string | null
	status: number
	file_count: bigint | number
	created_by: bigint | number
	created_at: Date
	updated_at: Date
}

/** 组校验行（编辑/删除前校验） */
export interface GroupCheckRow {
	id: bigint | number
	scope_type: number
	scope_ref_id: bigint | number | null
	owner_user_id: bigint | number
}

/** 部门查询行 */
export interface DepartmentRow {
	id: bigint | number
	name: string
	owner_user_id: bigint | number | null
	owner_name: string | null
}

/** 产品线查询行 */
export interface ProductLineRow {
	id: bigint | number
	name: string
	description: string | null
	owner_user_id: bigint | number | null
	owner_name: string | null
	status: number
	group_count: bigint | number
	created_at: Date
}

/** 产品线校验行 */
export interface ProductLineCheckRow {
	id: bigint | number
	owner_user_id: bigint | number | null
}

/** 存在性计数行 */
export interface CountRow {
	cnt: bigint | number
}
```

- [ ] **Step 4:** 提交

```
feat: 新增组/产品线 Zod schema 和服务端类型
```

---

## Task 3: 组树查询 API

**Files:**
- Create: `server/api/groups/tree.get.ts`

这是核心接口，需要一次查询组装三分类树结构。

- [ ] **Step 1:** 创建 `server/api/groups/tree.get.ts`

```typescript
/**
 * GET /api/groups/tree
 * 获取完整文档组树（公司层 / 按部门 / 按产品线）
 * 返回结构匹配前端 NavTreeCategory[]
 */
import { prisma } from '~/server/utils/prisma'
import type { GroupTreeRow, DepartmentRow, ProductLineRow } from '~/server/types/group'

interface TreeGroup {
	id: number
	name: string
	fileCount: number
	owner: string
	desc: string | null
	scopeType: number
	scopeRefId: number | null
	parentId: number | null
	children: TreeGroup[]
}

export default defineEventHandler(async () => {
	// 1) 查询所有未删除的组 + 负责人名称 + 已发布文档数
	const groups = await prisma.$queryRaw<GroupTreeRow[]>`
		SELECT
			g.id, g.parent_id, g.scope_type, g.scope_ref_id,
			g.name, g.description, g.owner_user_id,
			u.name AS owner_name,
			g.approval_enabled, g.file_size_limit_mb, g.status,
			COALESCE(dc.cnt, 0) AS file_count
		FROM doc_groups g
		LEFT JOIN doc_users u ON u.id = g.owner_user_id
		LEFT JOIN (
			SELECT group_id, COUNT(*) AS cnt
			FROM doc_documents
			WHERE status = 4 AND deleted_at IS NULL
			GROUP BY group_id
		) dc ON dc.group_id = g.id
		WHERE g.deleted_at IS NULL AND g.status = 1
		ORDER BY g.created_at ASC
	`

	// 2) 查询部门列表
	const departments = await prisma.$queryRaw<DepartmentRow[]>`
		SELECT d.id, d.name, d.owner_user_id, u.name AS owner_name
		FROM doc_departments d
		LEFT JOIN doc_users u ON u.id = d.owner_user_id
		WHERE d.deleted_at IS NULL AND d.status = 1
		ORDER BY d.created_at ASC
	`

	// 3) 查询产品线列表
	const productLines = await prisma.$queryRaw<(ProductLineRow & { group_count: bigint | number })[]>`
		SELECT
			pl.id, pl.name, pl.description, pl.owner_user_id,
			u.name AS owner_name, pl.status, pl.created_at,
			0 AS group_count
		FROM doc_product_lines pl
		LEFT JOIN doc_users u ON u.id = pl.owner_user_id
		WHERE pl.deleted_at IS NULL AND pl.status = 1
		ORDER BY pl.created_at ASC
	`

	// 4) 将平铺组列表构建为树
	const flatGroups: TreeGroup[] = groups.map(g => ({
		id: Number(g.id),
		name: g.name,
		fileCount: Number(g.file_count),
		owner: g.owner_name || '',
		desc: g.description,
		scopeType: g.scope_type,
		scopeRefId: g.scope_ref_id ? Number(g.scope_ref_id) : null,
		parentId: g.parent_id ? Number(g.parent_id) : null,
		children: [],
	}))

	// 按 ID 索引，用于快速查找父节点
	const groupMap = new Map<number, TreeGroup>()
	for (const g of flatGroups) groupMap.set(g.id, g)

	// 构建父子关系，收集顶级组
	const rootGroups: TreeGroup[] = []
	for (const g of flatGroups) {
		if (g.parentId && groupMap.has(g.parentId)) {
			groupMap.get(g.parentId)!.children.push(g)
		} else {
			rootGroups.push(g)
		}
	}

	// 5) 按 scope 分类
	const companyGroups = rootGroups.filter(g => g.scopeType === 1)
	const deptGroupsMap = new Map<number, TreeGroup[]>()
	const plGroupsMap = new Map<number, TreeGroup[]>()

	for (const g of rootGroups) {
		if (g.scopeType === 2 && g.scopeRefId) {
			if (!deptGroupsMap.has(g.scopeRefId)) deptGroupsMap.set(g.scopeRefId, [])
			deptGroupsMap.get(g.scopeRefId)!.push(g)
		}
		if (g.scopeType === 3 && g.scopeRefId) {
			if (!plGroupsMap.has(g.scopeRefId)) plGroupsMap.set(g.scopeRefId, [])
			plGroupsMap.get(g.scopeRefId)!.push(g)
		}
	}

	// 6) 组装最终响应
	const tree = [
		{
			id: 'company',
			label: '公司层',
			scope: 'company',
			badge: companyGroups.length,
			groups: companyGroups,
		},
		{
			id: 'department',
			label: '按部门',
			scope: 'department',
			badge: departments.length,
			orgUnits: departments.map(d => {
				const dGroups = deptGroupsMap.get(Number(d.id)) || []
				return {
					id: `dept_${d.id}`,
					label: d.name,
					badge: dGroups.length,
					groups: dGroups,
				}
			}),
		},
		{
			id: 'productline',
			label: '按产品线',
			scope: 'productline',
			badge: productLines.length,
			orgUnits: productLines.map(pl => {
				const pGroups = plGroupsMap.get(Number(pl.id)) || []
				return {
					id: `pl_${pl.id}`,
					label: pl.name,
					badge: pGroups.length,
					groups: pGroups,
				}
			}),
		},
	]

	return ok(tree)
})
```

- [ ] **Step 2:** 启动 dev server，用浏览器或 curl 测试 `GET /api/groups/tree`，确认返回种子数据的树结构

- [ ] **Step 3:** 提交

```
feat: 实现组树查询接口 GET /api/groups/tree
```

---

## Task 4: 组 CRUD API（详情 + 创建 + 编辑 + 删除）

**Files:**
- Create: `server/api/groups/[id].get.ts`
- Create: `server/api/groups/index.post.ts`
- Create: `server/api/groups/[id].put.ts`
- Create: `server/api/groups/[id].delete.ts`

### 4.1 组详情

- [ ] **Step 1:** 创建 `server/api/groups/[id].get.ts`

```typescript
/**
 * GET /api/groups/:id
 * 组详情
 */
import { prisma } from '~/server/utils/prisma'
import { GROUP_NOT_FOUND } from '~/server/constants/error-codes'
import type { GroupDetailRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, 'INVALID_PARAMS', '无效的组ID')

	const rows = await prisma.$queryRaw<GroupDetailRow[]>`
		SELECT
			g.id, g.parent_id, g.scope_type, g.scope_ref_id,
			g.name, g.description, g.owner_user_id,
			u.name AS owner_name,
			g.approval_enabled, g.file_size_limit_mb,
			g.allowed_file_types, g.file_name_regex,
			g.status,
			COALESCE(dc.cnt, 0) AS file_count,
			g.created_by, g.created_at, g.updated_at
		FROM doc_groups g
		LEFT JOIN doc_users u ON u.id = g.owner_user_id
		LEFT JOIN (
			SELECT group_id, COUNT(*) AS cnt
			FROM doc_documents
			WHERE status = 4 AND deleted_at IS NULL
			GROUP BY group_id
		) dc ON dc.group_id = g.id
		WHERE g.id = ${id} AND g.deleted_at IS NULL
	`

	if (!rows.length) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const g = rows[0]
	return ok({
		id: Number(g.id),
		name: g.name,
		description: g.description,
		scopeType: g.scope_type,
		scopeRefId: g.scope_ref_id ? Number(g.scope_ref_id) : null,
		parentId: g.parent_id ? Number(g.parent_id) : null,
		ownerUserId: Number(g.owner_user_id),
		ownerName: g.owner_name,
		approvalEnabled: g.approval_enabled,
		fileSizeLimitMb: g.file_size_limit_mb,
		allowedFileTypes: g.allowed_file_types,
		fileNameRegex: g.file_name_regex,
		status: g.status,
		fileCount: Number(g.file_count),
		createdBy: Number(g.created_by),
		createdAt: g.created_at.getTime(),
		updatedAt: g.updated_at.getTime(),
	})
})
```

### 4.2 创建组

- [ ] **Step 2:** 创建 `server/api/groups/index.post.ts`

```typescript
/**
 * POST /api/groups
 * 创建组 — 创建者自动成为负责人 + 加入成员表（管理员）
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { requireGroupPermission, requireCreateGroupPermission } from '~/server/utils/group-permission'
import { groupCreateSchema } from '~/server/schemas/group'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import {
	GROUP_NAME_EXISTS,
	PARENT_GROUP_NOT_FOUND,
} from '~/server/constants/error-codes'
import type { GroupCheckRow, CountRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, groupCreateSchema.parse)
	const userId = event.context.user!.id

	const name = body.name.trim()
	const description = body.description?.trim() || null
	const { scopeType, scopeRefId, parentId } = body

	// 有父组时：校验父组存在 + 继承 scope + 校验父组权限
	if (parentId) {
		const parents = await prisma.$queryRaw<GroupCheckRow[]>`
			SELECT id, scope_type, scope_ref_id, owner_user_id
			FROM doc_groups
			WHERE id = ${parentId} AND deleted_at IS NULL
		`
		if (!parents.length) return fail(event, 400, PARENT_GROUP_NOT_FOUND, '父组不存在')

		const parent = parents[0]
		const denied = await requireGroupPermission(event, {
			scopeType: parent.scope_type,
			scopeRefId: parent.scope_ref_id ? Number(parent.scope_ref_id) : null,
			ownerUserId: Number(parent.owner_user_id),
		})
		if (denied) return denied
	} else {
		// 顶级组：校验 scope 创建权限
		const denied = await requireCreateGroupPermission(event, scopeType, scopeRefId ?? null)
		if (denied) return denied
	}

	// 校验同级名称唯一
	const existing = await prisma.$queryRaw<CountRow[]>`
		SELECT COUNT(*) AS cnt FROM doc_groups
		WHERE parent_id ${parentId ? prisma.$queryRaw`= ${parentId}` : prisma.$queryRaw`IS NULL`}
			AND scope_type = ${scopeType}
			AND name = ${name}
			AND deleted_at IS NULL
	`
	if (Number(existing[0]?.cnt) > 0) {
		return fail(event, 409, GROUP_NAME_EXISTS, '同级下已存在同名组')
	}

	const groupId = generateId()
	const memberId = generateId()

	try {
		await prisma.$transaction([
			// 创建组
			prisma.$executeRaw`
				INSERT INTO doc_groups
					(id, parent_id, scope_type, scope_ref_id, name, description,
					 owner_user_id, created_by)
				VALUES
					(${groupId}, ${parentId ?? null}, ${scopeType}, ${scopeRefId ?? null},
					 ${name}, ${description}, ${userId}, ${userId})
			`,
			// 创建者加入成员表（role=1 管理员, source_type=1 手动, immutable_flag=1）
			prisma.$executeRaw`
				INSERT INTO doc_group_members
					(id, group_id, user_id, role, source_type, immutable_flag, created_by)
				VALUES
					(${memberId}, ${groupId}, ${userId}, 1, 1, 1, ${userId})
			`,
		])
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, GROUP_NAME_EXISTS, '同级下已存在同名组')
		}
		throw error
	}

	return ok({ id: Number(groupId) }, '组创建成功')
})
```

### 4.3 编辑组

- [ ] **Step 3:** 创建 `server/api/groups/[id].put.ts`

```typescript
/**
 * PUT /api/groups/:id
 * 编辑组（名称、描述）
 */
import { prisma } from '~/server/utils/prisma'
import { requireGroupPermission } from '~/server/utils/group-permission'
import { groupUpdateSchema } from '~/server/schemas/group'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import { GROUP_NOT_FOUND, GROUP_NAME_EXISTS, INVALID_PARAMS } from '~/server/constants/error-codes'
import type { GroupCheckRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const body = await readValidatedBody(event, groupUpdateSchema.parse)
	if (!body.name && body.description === undefined) {
		return fail(event, 400, INVALID_PARAMS, '至少提供一个修改字段')
	}

	// 校验组存在 + 权限
	const rows = await prisma.$queryRaw<GroupCheckRow[]>`
		SELECT id, scope_type, scope_ref_id, owner_user_id
		FROM doc_groups WHERE id = ${id} AND deleted_at IS NULL
	`
	if (!rows.length) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const group = rows[0]
	const denied = await requireGroupPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
	})
	if (denied) return denied

	// 构建更新字段
	const sets: string[] = []
	const params: unknown[] = []
	if (body.name) {
		sets.push('name = ?')
		params.push(body.name.trim())
	}
	if (body.description !== undefined) {
		sets.push('description = ?')
		params.push(body.description?.trim() || null)
	}

	try {
		// 使用 $executeRawUnsafe 拼接动态 SET 子句
		await prisma.$executeRawUnsafe(
			`UPDATE doc_groups SET ${sets.join(', ')} WHERE id = ?`,
			...params,
			id,
		)
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, GROUP_NAME_EXISTS, '同级下已存在同名组')
		}
		throw error
	}

	return ok(null, '组更新成功')
})
```

### 4.4 删除组

- [ ] **Step 4:** 创建 `server/api/groups/[id].delete.ts`

```typescript
/**
 * DELETE /api/groups/:id
 * 删除组（软删除） — 含文件或子组时拒绝
 */
import { prisma } from '~/server/utils/prisma'
import { requireGroupPermission } from '~/server/utils/group-permission'
import {
	GROUP_NOT_FOUND,
	GROUP_HAS_DOCUMENTS,
	GROUP_HAS_CHILDREN,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'
import type { GroupCheckRow, CountRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	// 校验组存在
	const rows = await prisma.$queryRaw<GroupCheckRow[]>`
		SELECT id, scope_type, scope_ref_id, owner_user_id
		FROM doc_groups WHERE id = ${id} AND deleted_at IS NULL
	`
	if (!rows.length) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	// 权限校验
	const group = rows[0]
	const denied = await requireGroupPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
	})
	if (denied) return denied

	// 检查是否含文档
	const docCount = await prisma.$queryRaw<CountRow[]>`
		SELECT COUNT(*) AS cnt FROM doc_documents
		WHERE group_id = ${id} AND deleted_at IS NULL
	`
	if (Number(docCount[0]?.cnt) > 0) {
		return fail(event, 400, GROUP_HAS_DOCUMENTS, '组内含文档，请先移除或删除文档')
	}

	// 检查是否含子组
	const childCount = await prisma.$queryRaw<CountRow[]>`
		SELECT COUNT(*) AS cnt FROM doc_groups
		WHERE parent_id = ${id} AND deleted_at IS NULL
	`
	if (Number(childCount[0]?.cnt) > 0) {
		return fail(event, 400, GROUP_HAS_CHILDREN, '组内含子组，请先删除子组')
	}

	// 软删除
	await prisma.$executeRaw`
		UPDATE doc_groups SET deleted_at = NOW(3) WHERE id = ${id}
	`

	return ok(null, '组已删除')
})
```

- [ ] **Step 5:** 逐个测试创建/详情/编辑/删除接口

- [ ] **Step 6:** 提交

```
feat: 实现组 CRUD 接口（详情/创建/编辑/删除）
```

---

## Task 5: 产品线 CRUD API

**Files:**
- Create: `server/api/product-lines/index.get.ts`
- Create: `server/api/product-lines/index.post.ts`
- Create: `server/api/product-lines/[id].put.ts`
- Create: `server/api/product-lines/[id].delete.ts`

- [ ] **Step 1:** 创建 `server/api/product-lines/index.get.ts`

```typescript
/**
 * GET /api/product-lines
 * 产品线列表（含负责人名称和组数量）
 */
import { prisma } from '~/server/utils/prisma'
import type { ProductLineRow } from '~/server/types/group'

export default defineEventHandler(async () => {
	const rows = await prisma.$queryRaw<ProductLineRow[]>`
		SELECT
			pl.id, pl.name, pl.description, pl.owner_user_id,
			u.name AS owner_name, pl.status, pl.created_at,
			COALESCE(gc.cnt, 0) AS group_count
		FROM doc_product_lines pl
		LEFT JOIN doc_users u ON u.id = pl.owner_user_id
		LEFT JOIN (
			SELECT scope_ref_id, COUNT(*) AS cnt
			FROM doc_groups
			WHERE scope_type = 3 AND parent_id IS NULL AND deleted_at IS NULL
			GROUP BY scope_ref_id
		) gc ON gc.scope_ref_id = pl.id
		WHERE pl.deleted_at IS NULL
		ORDER BY pl.created_at ASC
	`

	const list = rows.map(pl => ({
		id: Number(pl.id),
		name: pl.name,
		description: pl.description,
		ownerUserId: pl.owner_user_id ? Number(pl.owner_user_id) : null,
		ownerName: pl.owner_name || null,
		status: pl.status,
		groupCount: Number(pl.group_count),
		createdAt: pl.created_at.getTime(),
	}))

	return ok(list)
})
```

- [ ] **Step 2:** 创建 `server/api/product-lines/index.post.ts`

```typescript
/**
 * POST /api/product-lines
 * 创建产品线 — 仅 super_admin，创建者自动成为负责人
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { productLineCreateSchema } from '~/server/schemas/product-line'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import { PRODUCT_LINE_NAME_EXISTS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'super_admin')
	if (denied) return denied

	const body = await readValidatedBody(event, productLineCreateSchema.parse)
	const userId = event.context.user!.id
	const name = body.name.trim()
	const description = body.description?.trim() || null
	const id = generateId()

	try {
		await prisma.$executeRaw`
			INSERT INTO doc_product_lines (id, name, description, owner_user_id, created_by)
			VALUES (${id}, ${name}, ${description}, ${userId}, ${userId})
		`
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, PRODUCT_LINE_NAME_EXISTS, '产品线名称已存在')
		}
		throw error
	}

	return ok({ id: Number(id) }, '产品线创建成功')
})
```

- [ ] **Step 3:** 创建 `server/api/product-lines/[id].put.ts`

```typescript
/**
 * PUT /api/product-lines/:id
 * 编辑产品线 — 仅 super_admin
 */
import { prisma } from '~/server/utils/prisma'
import { productLineUpdateSchema } from '~/server/schemas/product-line'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import {
	PRODUCT_LINE_NOT_FOUND,
	PRODUCT_LINE_NAME_EXISTS,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'
import type { ProductLineCheckRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'super_admin')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的产品线ID')

	const body = await readValidatedBody(event, productLineUpdateSchema.parse)
	if (!body.name && body.description === undefined) {
		return fail(event, 400, INVALID_PARAMS, '至少提供一个修改字段')
	}

	// 校验存在
	const rows = await prisma.$queryRaw<ProductLineCheckRow[]>`
		SELECT id, owner_user_id FROM doc_product_lines
		WHERE id = ${id} AND deleted_at IS NULL
	`
	if (!rows.length) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	const sets: string[] = []
	const params: unknown[] = []
	if (body.name) {
		sets.push('name = ?')
		params.push(body.name.trim())
	}
	if (body.description !== undefined) {
		sets.push('description = ?')
		params.push(body.description?.trim() || null)
	}

	try {
		await prisma.$executeRawUnsafe(
			`UPDATE doc_product_lines SET ${sets.join(', ')} WHERE id = ?`,
			...params,
			id,
		)
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, PRODUCT_LINE_NAME_EXISTS, '产品线名称已存在')
		}
		throw error
	}

	return ok(null, '产品线更新成功')
})
```

- [ ] **Step 4:** 创建 `server/api/product-lines/[id].delete.ts`

```typescript
/**
 * DELETE /api/product-lines/:id
 * 删除产品线（软删除） — 仅 super_admin，含组时拒绝
 */
import { prisma } from '~/server/utils/prisma'
import {
	PRODUCT_LINE_NOT_FOUND,
	PRODUCT_LINE_HAS_GROUPS,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'
import type { ProductLineCheckRow, CountRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'super_admin')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的产品线ID')

	const rows = await prisma.$queryRaw<ProductLineCheckRow[]>`
		SELECT id, owner_user_id FROM doc_product_lines
		WHERE id = ${id} AND deleted_at IS NULL
	`
	if (!rows.length) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	// 检查是否含组
	const groupCount = await prisma.$queryRaw<CountRow[]>`
		SELECT COUNT(*) AS cnt FROM doc_groups
		WHERE scope_type = 3 AND scope_ref_id = ${id} AND deleted_at IS NULL
	`
	if (Number(groupCount[0]?.cnt) > 0) {
		return fail(event, 400, PRODUCT_LINE_HAS_GROUPS, '产品线下含文档组，请先删除')
	}

	await prisma.$executeRaw`
		UPDATE doc_product_lines SET deleted_at = NOW(3) WHERE id = ${id}
	`

	return ok(null, '产品线已删除')
})
```

- [ ] **Step 5:** 测试全部产品线接口

- [ ] **Step 6:** 提交

```
feat: 实现产品线 CRUD 接口
```

---

## Task 6: 前端类型 + API 封装

**Files:**
- Create: `types/group.ts`
- Create: `api/groups.ts`
- Create: `api/product-lines.ts`
- Modify: `types/doc-nav-tree.ts`

- [ ] **Step 1:** 创建 `types/group.ts`

```typescript
/**
 * 文档组 & 产品线 — 前端类型
 */

/** 组详情 */
export interface GroupDetail {
	id: number
	name: string
	description: string | null
	scopeType: number
	scopeRefId: number | null
	parentId: number | null
	ownerUserId: number
	ownerName: string
	approvalEnabled: number
	fileSizeLimitMb: number
	allowedFileTypes: string | null
	fileNameRegex: string | null
	status: number
	fileCount: number
	createdBy: number
	createdAt: number
	updatedAt: number
}

/** 产品线列表项 */
export interface ProductLineItem {
	id: number
	name: string
	description: string | null
	ownerUserId: number | null
	ownerName: string | null
	status: number
	groupCount: number
	createdAt: number
}
```

- [ ] **Step 2:** 在 `types/doc-nav-tree.ts` 的 `NavTreeGroup` 中补充字段

在 `NavTreeGroup` 接口中追加以下可选字段:

```typescript
scopeType?: number
scopeRefId?: number | null
parentId?: number | null
```

- [ ] **Step 3:** 创建 `api/groups.ts`

```typescript
import type { ApiResult } from '~/types/api'
import type { NavTreeCategory } from '~/types/doc-nav-tree'
import type { GroupDetail } from '~/types/group'
import type { GroupCreateBody, GroupUpdateBody } from '~/server/schemas/group'

/** 获取文档组树 */
export function apiGetGroupTree() {
	return useAuthFetch<ApiResult<NavTreeCategory[]>>('/api/groups/tree')
}

/** 组详情 */
export function apiGetGroup(id: number) {
	return useAuthFetch<ApiResult<GroupDetail>>(`/api/groups/${id}`)
}

/** 创建组 */
export function apiCreateGroup(params: GroupCreateBody) {
	return useAuthFetch<ApiResult<{ id: number }>>('/api/groups', {
		method: 'POST',
		body: params,
	})
}

/** 编辑组 */
export function apiUpdateGroup(id: number, params: GroupUpdateBody) {
	return useAuthFetch<ApiResult>(`/api/groups/${id}`, {
		method: 'PUT',
		body: params,
	})
}

/** 删除组 */
export function apiDeleteGroup(id: number) {
	return useAuthFetch<ApiResult>(`/api/groups/${id}`, {
		method: 'DELETE',
	})
}
```

- [ ] **Step 4:** 创建 `api/product-lines.ts`

```typescript
import type { ApiResult } from '~/types/api'
import type { ProductLineItem } from '~/types/group'
import type { ProductLineCreateBody, ProductLineUpdateBody } from '~/server/schemas/product-line'

/** 产品线列表 */
export function apiGetProductLines() {
	return useAuthFetch<ApiResult<ProductLineItem[]>>('/api/product-lines')
}

/** 创建产品线 */
export function apiCreateProductLine(params: ProductLineCreateBody) {
	return useAuthFetch<ApiResult<{ id: number }>>('/api/product-lines', {
		method: 'POST',
		body: params,
	})
}

/** 编辑产品线 */
export function apiUpdateProductLine(id: number, params: ProductLineUpdateBody) {
	return useAuthFetch<ApiResult>(`/api/product-lines/${id}`, {
		method: 'PUT',
		body: params,
	})
}

/** 删除产品线 */
export function apiDeleteProductLine(id: number) {
	return useAuthFetch<ApiResult>(`/api/product-lines/${id}`, {
		method: 'DELETE',
	})
}
```

- [ ] **Step 5:** 提交

```
feat: 新增组/产品线前端类型和 API 封装
```

---

## Task 7: 前端组件 — GroupFormModal + ProductLineFormModal

**Files:**
- Create: `components/GroupFormModal.vue`
- Create: `components/ProductLineFormModal.vue`

- [ ] **Step 1:** 创建 `components/GroupFormModal.vue`

组创建/编辑弹窗。创建模式显示创建位置路径，编辑模式加载现有数据。

关键点:
- Props: `visible`, `mode('create'|'edit')`, `group?(编辑时)`, `location?(位置路径)`, `scopeType?`, `scopeRefId?`, `parentId?`
- 表单: 组名称（必填）、描述（选填）
- 创建模式显示只读的「创建位置」
- 使用 `apiCreateGroup` / `apiUpdateGroup`
- 成功后 emit `success` 事件，外层刷新树
- 使用 `useNotify` 提示结果，优先使用后端返回的 message
- 使用项目的 `Modal` 组件包装（如果适合），否则用 `el-dialog`

- [ ] **Step 2:** 创建 `components/ProductLineFormModal.vue`

产品线创建/编辑弹窗。

关键点:
- Props: `visible`, `mode('create'|'edit')`, `productLine?(编辑时)`
- 表单: 名称（必填）、描述（选填）
- 创建模式底部提示「创建者将自动成为产品线负责人」
- 使用 `apiCreateProductLine` / `apiUpdateProductLine`
- 成功后 emit `success` 事件

- [ ] **Step 3:** 启动 dev server，在页面中临时挂载两个弹窗测试

- [ ] **Step 4:** 提交

```
feat: 新增 GroupFormModal 和 ProductLineFormModal 组件
```

---

## Task 8: 前端组件 — TreeActionMenu + DocExplorerPanel

**Files:**
- Create: `components/TreeActionMenu.vue`
- Create: `components/DocExplorerPanel.vue`

- [ ] **Step 1:** 创建 `components/TreeActionMenu.vue`

树节点「更多」操作下拉菜单。

关键点:
- 使用 `el-dropdown` 实现，通过 `ref` 手动触发 `handleOpen`
- Props: 无固定 props，通过 expose 方法打开: `open(event, nodeType, nodeData)`
- `nodeType`: `'category'|'org'|'group'`
- 根据节点类型 + 用户权限（通过 `useAuth().can()` / `hasRole()`）动态生成菜单项
- 组节点: 编辑、创建子组、删除
- 部门节点: 创建组（部门不可编辑/删除）
- 产品线节点: 编辑、创建组、删除
- Emit: `edit`, `create-child`, `delete` 事件，携带节点数据

- [ ] **Step 2:** 创建 `components/DocExplorerPanel.vue`

右侧面板，根据选中节点类型展示不同内容。

关键点:
- Props: `type('empty'|'category'|'department'|'productline'|'group')`, `data`
- `empty`: 空状态引导（使用 `EmptyState` 组件或简单图标+文字）
- `category`: 展示该分类下的组卡片列表
- `department`: 部门名称 + 负责人 + 组卡片列表
- `productline`: 产品线名称 + 描述 + 负责人 + 组卡片列表
- `group`: 组详情卡片（名称、描述、负责人、文档数、创建时间）+ 「进入仓库」按钮
- 组卡片: 组名、描述、文档数量、负责人，点击跳转 `/docs/repo/[id]`

- [ ] **Step 3:** 浏览器中验证两个组件的渲染

- [ ] **Step 4:** 提交

```
feat: 新增 TreeActionMenu 和 DocExplorerPanel 组件
```

---

## Task 9: 页面集成 — pages/docs/index.vue

**Files:**
- Modify: `pages/docs/index.vue`

这是最关键的集成任务，将所有组件串联起来。

- [ ] **Step 1:** 重构 `pages/docs/index.vue`

改动要点:
1. 移除全部 mock 数据（`treeCategories`、`allRepos`、`filteredRepos`）
2. 页面加载时调用 `apiGetGroupTree()` 获取树数据
3. 使用 `usePageLoading()` 管理初始加载状态
4. 接入 `DocExplorerPanel` 替代右侧面板
5. 接入 `GroupFormModal`、`ProductLineFormModal`、`TreeActionMenu`
6. 处理所有树事件:
   - `category-create`: 公司层→打开 GroupFormModal（scopeType=1），产品线分类→打开 ProductLineFormModal
   - `org-create`: 部门/产品线节点→打开 GroupFormModal（预填 scopeType + scopeRefId）
   - `group-create`: 打开 GroupFormModal（预填 parentId）
   - `category-more` / `org-more` / `group-more`: 打开 TreeActionMenu
   - `group-select`: 更新右侧面板为组详情
   - `category-select`: 更新右侧面板为分类概览
7. 弹窗 success 回调: 重新 `fetchTree()` 刷新
8. 删除操作: 使用 `ElMessageBox.confirm` 二次确认

- [ ] **Step 2:** 浏览器中完整测试全部交互流程

测试清单:
- 页面加载后树展示种子数据（公司层1组、按部门2组、按产品线1组）
- 点击组节点→右侧显示组详情
- 点击部门节点→右侧显示部门信息+组列表
- 点击产品线节点→右侧显示产品线信息+组列表
- 公司层「+」→创建组弹窗
- 产品线分类「+」→创建产品线弹窗
- 部门节点「+」→创建组弹窗（位置预填该部门）
- 组节点「+」→创建子组弹窗
- 组节点「...」→编辑/删除菜单
- 创建组→成功→树自动刷新
- 删除空组→成功→树自动刷新
- 删除含子组的组→被拒绝
- 搜索功能正常

- [ ] **Step 3:** 提交

```
feat: 文档主页接入真实组树数据，完成组/产品线 CRUD 交互
```

---

## Task 10: 更新进度文档

**Files:**
- Modify: `docs/dev-progress.md`

- [ ] **Step 1:** 在 `docs/dev-progress.md` 中添加本次开发记录

- [ ] **Step 2:** 提交所有文档变更

```
docs: 更新开发进度追踪
```
