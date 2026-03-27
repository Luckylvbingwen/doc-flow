/**
 * GET /api/rbac/roles/:id
 * 获取角色详情（含已分配的权限列表）
 */
import { prisma } from '~/server/utils/prisma'
import type { RoleDetailRow, PermRow } from '~/server/types/rbac'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:read')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) {
		return fail(event, 400, 'INVALID_PARAMS', '无效的角色 ID')
	}

	const rows = await prisma.$queryRaw<RoleDetailRow[]>`
		SELECT id, code, name, description, is_system, status, created_at
		FROM sys_roles
		WHERE id = ${id} AND deleted_at IS NULL
		LIMIT 1
	`

	if (!rows.length) {
		return fail(event, 404, 'ROLE_NOT_FOUND', '角色不存在')
	}

	const role = rows[0]

	// 获取角色已分配的权限
	const perms = await prisma.$queryRaw<PermRow[]>`
		SELECT p.id, p.code, p.name, p.module, p.description, p.sort_order
		FROM sys_permissions p
		JOIN sys_role_permissions rp ON rp.permission_id = p.id
		WHERE rp.role_id = ${id}
		ORDER BY p.sort_order, p.id
	`

	return ok({
		id: Number(role.id),
		code: role.code,
		name: role.name,
		description: role.description,
		isSystem: role.is_system === 1,
		status: role.status,
		createdAt: new Date(role.created_at).getTime(),
		permissions: perms.map(p => ({
			id: Number(p.id),
			code: p.code,
			name: p.name,
			module: p.module,
			description: p.description,
			sortOrder: p.sort_order
		}))
	})
})
