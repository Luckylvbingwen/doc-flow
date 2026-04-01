/**
 * POST /api/rbac/user-roles/revoke
 * 撤销用户角色
 */
import { prisma } from '~/server/utils/prisma'
import { userRoleRevokeSchema } from '~/server/schemas/rbac'
import { NOT_FOUND } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:assign')
	if (denied) return denied

	const body = await readValidatedBody(event, userRoleRevokeSchema.parse)

	const userId = body.userId
	const roleId = body.roleId

	const affected = await prisma.$executeRaw`
		DELETE FROM sys_user_roles
		WHERE user_id = ${userId} AND role_id = ${roleId}
	`

	if (affected === 0) {
		return fail(event, 404, NOT_FOUND, '未找到该用户角色关联')
	}

	return ok(null, '角色撤销成功')
})
