/**
 * GET /api/rbac/user-roles
 * 用户-角色关联列表
 */
import { prisma } from '~/server/utils/prisma'
import { userRoleListQuerySchema } from '~/server/schemas/rbac'
import type { UserRoleRow } from '~/server/types/rbac'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:read')
	if (denied) return denied

	const query = await getValidatedQuery(event, userRoleListQuerySchema.parse)
	const page = query.page
	const pageSize = query.pageSize
	const keyword = query.keyword
	const roleId = query.roleId ?? 0
	const offset = (page - 1) * pageSize

	// 动态构建条件（用原始 SQL）
	let _whereClause = 'WHERE 1=1'
	const _params: unknown[] = []

	if (roleId > 0) {
		_whereClause += ` AND ur.role_id = ${roleId}`
	}

	// 总数 & 列表查询
	let countRows: Array<{ cnt: bigint | number }>
	let rows: UserRoleRow[]

	if (keyword) {
		const like = `%${keyword}%`
		countRows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
			SELECT COUNT(*) as cnt
			FROM sys_user_roles ur
			JOIN doc_users u ON u.id = ur.user_id
			JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
			WHERE u.deleted_at IS NULL
			  AND (u.name LIKE ${like} OR u.email LIKE ${like})
			  AND (${roleId} = 0 OR ur.role_id = ${roleId})
		`
		rows = await prisma.$queryRaw<UserRoleRow[]>`
			SELECT
				ur.id, ur.user_id, u.name AS user_name, u.email AS user_email,
				ur.role_id, r.code AS role_code, r.name AS role_name, ur.created_at
			FROM sys_user_roles ur
			JOIN doc_users u ON u.id = ur.user_id
			JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
			WHERE u.deleted_at IS NULL
			  AND (u.name LIKE ${like} OR u.email LIKE ${like})
			  AND (${roleId} = 0 OR ur.role_id = ${roleId})
			ORDER BY ur.created_at DESC
			LIMIT ${pageSize} OFFSET ${offset}
		`
	} else {
		countRows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
			SELECT COUNT(*) as cnt
			FROM sys_user_roles ur
			JOIN doc_users u ON u.id = ur.user_id
			JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
			WHERE u.deleted_at IS NULL
			  AND (${roleId} = 0 OR ur.role_id = ${roleId})
		`
		rows = await prisma.$queryRaw<UserRoleRow[]>`
			SELECT
				ur.id, ur.user_id, u.name AS user_name, u.email AS user_email,
				ur.role_id, r.code AS role_code, r.name AS role_name, ur.created_at
			FROM sys_user_roles ur
			JOIN doc_users u ON u.id = ur.user_id
			JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
			WHERE u.deleted_at IS NULL
			  AND (${roleId} = 0 OR ur.role_id = ${roleId})
			ORDER BY ur.created_at DESC
			LIMIT ${pageSize} OFFSET ${offset}
		`
	}

	return ok({
		list: rows.map(r => ({
			id: Number(r.id),
			userId: Number(r.user_id),
			userName: r.user_name,
			userEmail: r.user_email,
			roleId: Number(r.role_id),
			roleCode: r.role_code,
			roleName: r.role_name,
			createdAt: new Date(r.created_at).getTime()
		})),
		total: Number(countRows[0]?.cnt ?? 0),
		page,
		pageSize
	})
})
