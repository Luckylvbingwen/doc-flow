/**
 * GET /api/admin/users
 * 系统管理页面 — 用户列表（§6.9.2）
 *
 * 查询参数见 server/schemas/admin.ts：keyword / roles[] / status / page / pageSize
 * 返回 AdminUserListResponse：多角色聚合 + 管理范围 + 排序权重
 *
 * 排序：系统管理员 → 公司层管理员 → 产品线负责人 → 部门负责人 → 无系统角色
 * 鉴权：admin:user_read（仅 super_admin）
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { adminUserListQuerySchema } from '~/server/schemas/admin'
import {
	SYSTEM_ROLE_CODES, SYSTEM_ROLE_META, USER_STATUS_FILTER,
	type SystemRoleCode,
} from '~/server/constants/system-roles'
import type {
	AdminUserItem, AdminUserListResponse, AdminUserRole, AdminUserScopes,
} from '~/server/types/admin'

interface UserRow {
	id: bigint
	name: string
	email: string | null
	avatar_url: string | null
	status: number
	created_at: Date
	updated_at: Date
	role_codes: string | null
	sort_weight: number
}

interface ScopeRow {
	user_id: bigint
	ref_id: bigint
	ref_name: string
}

const ROLE_SORT_WEIGHT_SQL = Prisma.sql`CASE r.code
	WHEN 'super_admin'   THEN 1
	WHEN 'company_admin' THEN 2
	WHEN 'pl_head'       THEN 3
	WHEN 'dept_head'     THEN 4
	ELSE 999
END`

export default defineEventHandler(async (event): Promise<{ data: AdminUserListResponse } | unknown> => {
	const denied = await requirePermission(event, 'admin:user_read')
	if (denied) return denied

	const query = await getValidatedQuery(event, adminUserListQuerySchema.parse)
	const { keyword, roles, status, page, pageSize } = query
	const offset = (page - 1) * pageSize

	// ── 基础 WHERE（keyword / status） ──
	const baseFilters: Prisma.Sql[] = [Prisma.sql`u.deleted_at IS NULL`]

	if (keyword) {
		const like = `%${keyword}%`
		baseFilters.push(Prisma.sql`(u.name LIKE ${like} OR u.email LIKE ${like})`)
	}

	if (status === USER_STATUS_FILTER.ACTIVE) {
		baseFilters.push(Prisma.sql`u.status = 1`)
	} else if (status === USER_STATUS_FILTER.DEACTIVATED) {
		baseFilters.push(Prisma.sql`u.status = 0`)
	}

	// ── 角色筛选（支持 'none' + 具体 code 组合） ──
	if (roles && roles.length > 0) {
		const concreteRoles = roles.filter(r => r !== 'none')
		const includeNone = roles.includes('none')

		const roleConditions: Prisma.Sql[] = []

		if (concreteRoles.length > 0) {
			roleConditions.push(Prisma.sql`
				EXISTS (
					SELECT 1 FROM sys_user_roles ur2
					JOIN sys_roles r2 ON r2.id = ur2.role_id AND r2.deleted_at IS NULL
					WHERE ur2.user_id = u.id AND r2.code IN (${Prisma.join(concreteRoles)})
				)
			`)
		}

		if (includeNone) {
			roleConditions.push(Prisma.sql`
				NOT EXISTS (
					SELECT 1 FROM sys_user_roles ur3
					JOIN sys_roles r3 ON r3.id = ur3.role_id AND r3.deleted_at IS NULL
					WHERE ur3.user_id = u.id
				)
			`)
		}

		if (roleConditions.length > 0) {
			baseFilters.push(Prisma.sql`(${Prisma.join(roleConditions, ' OR ')})`)
		}
	}

	const whereSql = Prisma.sql`${Prisma.join(baseFilters, ' AND ')}`

	// ── 总数 ──
	const countRows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
		SELECT COUNT(*) AS cnt
		FROM doc_users u
		WHERE ${whereSql}
	`
	const total = Number(countRows[0]?.cnt ?? 0)

	if (total === 0) {
		return ok<AdminUserListResponse>({ list: [], total: 0, page, pageSize })
	}

	// ── 主查询（多角色聚合 + 排序权重） ──
	const rows = await prisma.$queryRaw<UserRow[]>`
		SELECT
			u.id, u.name, u.email, u.avatar_url, u.status, u.created_at, u.updated_at,
			GROUP_CONCAT(DISTINCT r.code ORDER BY r.code) AS role_codes,
			COALESCE(MIN(${ROLE_SORT_WEIGHT_SQL}), 999) AS sort_weight
		FROM doc_users u
		LEFT JOIN sys_user_roles ur ON ur.user_id = u.id
		LEFT JOIN sys_roles       r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ${whereSql}
		GROUP BY u.id, u.name, u.email, u.avatar_url, u.status, u.created_at, u.updated_at
		ORDER BY sort_weight ASC, u.id ASC
		LIMIT ${pageSize} OFFSET ${offset}
	`

	const userIds = rows.map(r => r.id)

	// ── 批量查产品线归属（pl_head 的 scope） ──
	const productLines = userIds.length === 0 ? [] : await prisma.$queryRaw<ScopeRow[]>`
		SELECT owner_user_id AS user_id, id AS ref_id, name AS ref_name
		FROM doc_product_lines
		WHERE deleted_at IS NULL AND owner_user_id IN (${Prisma.join(userIds)})
	`

	// ── 批量查部门归属（dept_head 的 scope） ──
	const departments = userIds.length === 0 ? [] : await prisma.$queryRaw<ScopeRow[]>`
		SELECT owner_user_id AS user_id, id AS ref_id, name AS ref_name
		FROM doc_departments
		WHERE deleted_at IS NULL AND owner_user_id IN (${Prisma.join(userIds)})
	`

	// ── 组装响应 ──
	const plMap = new Map<string, Array<{ id: number; name: string }>>()
	for (const pl of productLines) {
		const key = String(pl.user_id)
		if (!plMap.has(key)) plMap.set(key, [])
		plMap.get(key)!.push({ id: Number(pl.ref_id), name: pl.ref_name })
	}

	const deptMap = new Map<string, Array<{ id: number; name: string; feishuSynced: boolean }>>()
	for (const d of departments) {
		const key = String(d.user_id)
		if (!deptMap.has(key)) deptMap.set(key, [])
		deptMap.get(key)!.push({ id: Number(d.ref_id), name: d.ref_name, feishuSynced: true })
	}

	const list: AdminUserItem[] = rows.map((row) => {
		const codes = (row.role_codes ?? '').split(',').filter(Boolean) as SystemRoleCode[]
		const userKey = String(row.id)

		const rolesList: AdminUserRole[] = codes
			.filter(code => SYSTEM_ROLE_META[code])
			.map(code => ({
				code,
				name: SYSTEM_ROLE_META[code].name,
				feishuSynced: code === SYSTEM_ROLE_CODES.DEPT_HEAD,
			}))

		const scopes: AdminUserScopes = {
			companyAdmin: codes.includes(SYSTEM_ROLE_CODES.COMPANY_ADMIN),
			productLines: plMap.get(userKey) ?? [],
			departments: deptMap.get(userKey) ?? [],
		}

		return {
			id: Number(row.id),
			name: row.name,
			email: row.email,
			avatarUrl: row.avatar_url,
			status: (row.status === 1 ? 1 : 0) as 0 | 1,
			roles: rolesList,
			scopes,
			createdAt: new Date(row.created_at).getTime(),
			deactivatedAt: row.status === 0 ? new Date(row.updated_at).getTime() : null,
		}
	})

	return ok<AdminUserListResponse>({ list, total, page, pageSize })
})
