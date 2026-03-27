/**
 * GET /api/rbac/roles
 * 角色列表（含权限数 & 用户数）
 */
import { prisma } from '~/server/utils/prisma'
import type { RoleListRow as RoleRow } from '~/server/types/rbac'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:read')
	if (denied) return denied

	const query = getQuery(event)
	const page = Math.max(1, Number(query.page) || 1)
	const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
	const keyword = (query.keyword as string || '').trim()
	const offset = (page - 1) * pageSize

	// 总数
	let countRows: Array<{ cnt: bigint | number }>
	if (keyword) {
		const like = `%${keyword}%`
		countRows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
			SELECT COUNT(*) as cnt FROM sys_roles
			WHERE deleted_at IS NULL AND (name LIKE ${like} OR code LIKE ${like})
		`
	} else {
		countRows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
			SELECT COUNT(*) as cnt FROM sys_roles WHERE deleted_at IS NULL
		`
	}
	const total = Number(countRows[0]?.cnt ?? 0)

	// 列表
	let rows: RoleRow[]
	if (keyword) {
		const like = `%${keyword}%`
		rows = await prisma.$queryRaw<RoleRow[]>`
			SELECT
				r.id, r.code, r.name, r.description, r.is_system, r.status, r.created_at,
				(SELECT COUNT(*) FROM sys_role_permissions WHERE role_id = r.id) AS permission_count,
				(SELECT COUNT(*) FROM sys_user_roles WHERE role_id = r.id) AS user_count
			FROM sys_roles r
			WHERE r.deleted_at IS NULL AND (r.name LIKE ${like} OR r.code LIKE ${like})
			ORDER BY r.is_system DESC, r.id
			LIMIT ${pageSize} OFFSET ${offset}
		`
	} else {
		rows = await prisma.$queryRaw<RoleRow[]>`
			SELECT
				r.id, r.code, r.name, r.description, r.is_system, r.status, r.created_at,
				(SELECT COUNT(*) FROM sys_role_permissions WHERE role_id = r.id) AS permission_count,
				(SELECT COUNT(*) FROM sys_user_roles WHERE role_id = r.id) AS user_count
			FROM sys_roles r
			WHERE r.deleted_at IS NULL
			ORDER BY r.is_system DESC, r.id
			LIMIT ${pageSize} OFFSET ${offset}
		`
	}

	return ok({
		list: rows.map(r => ({
			id: Number(r.id),
			code: r.code,
			name: r.name,
			description: r.description,
			isSystem: r.is_system === 1,
			status: r.status,
			permissionCount: Number(r.permission_count),
			userCount: Number(r.user_count),
			createdAt: new Date(r.created_at).getTime()
		})),
		total,
		page,
		pageSize
	})
})
