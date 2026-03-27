/**
 * GET /api/rbac/permissions
 * 获取全部权限列表（按 module 分组）
 */
import { prisma } from '~/server/utils/prisma'
import type { PermRow } from '~/server/types/rbac'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'permission:read')
	if (denied) return denied

	const rows = await prisma.$queryRaw<PermRow[]>`
		SELECT id, code, name, module, description, sort_order
		FROM sys_permissions
		ORDER BY sort_order, id
	`

	const permissions = rows.map(r => ({
		id: Number(r.id),
		code: r.code,
		name: r.name,
		module: r.module,
		description: r.description,
		sortOrder: r.sort_order
	}))

	return ok(permissions)
})
