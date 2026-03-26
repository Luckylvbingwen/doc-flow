/**
 * POST /api/rbac/user-roles/revoke
 * 撤销用户角色
 */
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:assign')
	if (denied) return denied

	const body = await readBody<{
		userId?: number
		roleId?: number
	}>(event)

	const userId = Number(body.userId)
	const roleId = Number(body.roleId)

	if (!userId || !roleId) {
		return fail(event, 400, 'INVALID_PARAMS', '用户 ID 和角色 ID 不能为空')
	}

	const affected = await prisma.$executeRaw`
		DELETE FROM sys_user_roles
		WHERE user_id = ${userId} AND role_id = ${roleId}
	`

	if (affected === 0) {
		return fail(event, 404, 'NOT_FOUND', '未找到该用户角色关联')
	}

	return ok(null, '角色撤销成功')
})
