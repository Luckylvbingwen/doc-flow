/**
 * DELETE /api/rbac/roles/:id
 * 软删除角色（系统内置角色不可删除）
 */
import { prisma } from '~/server/utils/prisma'
import type { RoleCheckRow } from '~/server/types/rbac'
import { INVALID_PARAMS, ROLE_NOT_FOUND, SYSTEM_ROLE_PROTECTED } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:delete')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) {
		return fail(event, 400, INVALID_PARAMS, '无效的角色 ID')
	}

	const rows = await prisma.$queryRaw<RoleCheckRow[]>`
		SELECT is_system FROM sys_roles
		WHERE id = ${id} AND deleted_at IS NULL
		LIMIT 1
	`

	if (!rows.length) {
		return fail(event, 404, ROLE_NOT_FOUND, '角色不存在')
	}

	if (rows[0].is_system === 1) {
		return fail(event, 400, SYSTEM_ROLE_PROTECTED, '系统内置角色不可删除')
	}

	// 软删除：设置 deleted_at + 清理关联
	await prisma.$transaction([
		prisma.$executeRaw`
			DELETE FROM sys_role_permissions WHERE role_id = ${id}
		`,
		prisma.$executeRaw`
			DELETE FROM sys_user_roles WHERE role_id = ${id}
		`,
		prisma.$executeRaw`
			UPDATE sys_roles SET deleted_at = NOW(3) WHERE id = ${id}
		`
	])

	return ok(null, '角色删除成功')
})
