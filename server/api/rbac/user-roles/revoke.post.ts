/**
 * POST /api/rbac/user-roles/revoke
 * 撤销用户角色
 */
import { prisma } from '~/server/utils/prisma'
import { userRoleRevokeSchema } from '~/server/schemas/rbac'
import { NOT_FOUND } from '~/server/constants/error-codes'
import { createNotification } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:assign')
	if (denied) return denied

	const body = await readValidatedBody(event, userRoleRevokeSchema.parse)

	const userId = body.userId
	const roleId = body.roleId

	// 先查角色名（删除后无法再查）
	const roleRow = await prisma.$queryRaw<Array<{ name: string }>>`
		SELECT name FROM sys_roles WHERE id = ${roleId} LIMIT 1
	`
	const roleName = roleRow[0]?.name ?? '未知角色'

	const affected = await prisma.$executeRaw`
		DELETE FROM sys_user_roles
		WHERE user_id = ${userId} AND role_id = ${roleId}
	`

	if (affected === 0) {
		return fail(event, 404, NOT_FOUND, '未找到该用户角色关联')
	}

	// M21 通知：通知被撤销角色的用户
	await createNotification(NOTIFICATION_TEMPLATES.M21.build({
		toUserId: userId,
		action: 'revoke',
		roleName,
	}))

	return ok(null, '角色撤销成功')
})
