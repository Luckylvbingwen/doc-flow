/**
 * PUT /api/rbac/roles/:id/permissions
 * 设置角色权限（全量替换）
 */
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:update')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) {
		return fail(event, 400, 'INVALID_PARAMS', '无效的角色 ID')
	}

	const body = await readBody<{ permissionIds?: number[] }>(event)
	const permissionIds = body.permissionIds

	if (!Array.isArray(permissionIds)) {
		return fail(event, 400, 'INVALID_PARAMS', 'permissionIds 必须为数组')
	}

	// 检查角色存在
	const roleCheck = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
		SELECT COUNT(*) as cnt FROM sys_roles
		WHERE id = ${id} AND deleted_at IS NULL
	`
	if (Number(roleCheck[0]?.cnt) === 0) {
		return fail(event, 404, 'ROLE_NOT_FOUND', '角色不存在')
	}

	// 事务：先清空再批量插入
	await prisma.$transaction(async (tx) => {
		await tx.$executeRaw`DELETE FROM sys_role_permissions WHERE role_id = ${id}`

		for (const permId of permissionIds) {
			if (typeof permId === 'number' && permId > 0) {
				await tx.$executeRaw`
					INSERT IGNORE INTO sys_role_permissions (role_id, permission_id)
					VALUES (${id}, ${permId})
				`
			}
		}
	})

	return ok(null, '权限分配成功')
})
