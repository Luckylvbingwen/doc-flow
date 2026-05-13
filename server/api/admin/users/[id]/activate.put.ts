/**
 * PUT /api/admin/users/:id/activate
 * 重新启用已停用用户 — status=1
 * 鉴权：admin:role_assign（仅 super_admin）
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import {
	INVALID_PARAMS,
	USER_NOT_FOUND,
	ADMIN_USER_ALREADY_ACTIVE,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'admin:role_assign')
	if (denied) return denied

	const userIdParam = getRouterParam(event, 'id')
	const userId = Number(userIdParam)
	if (!Number.isFinite(userId) || userId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '用户 ID 无效')
	}

	const operatorId = Number(event.context.user?.id ?? 0)
	const operatorName = event.context.user?.name ?? '管理员'

	const targetUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(userId), deleted_at: null },
		select: { id: true, name: true, status: true },
	})
	if (!targetUser) return fail(event, 404, USER_NOT_FOUND, '用户不存在')
	if (targetUser.status === 1) return fail(event, 409, ADMIN_USER_ALREADY_ACTIVE, '用户已处于启用状态')

	await prisma.doc_users.update({
		where: { id: BigInt(userId) },
		data: { status: 1, updated_at: new Date() },
	})

	await writeLog({
		actorUserId: operatorId,
		action: LOG_ACTIONS.ADMIN_USER_ACTIVATE,
		targetType: 'user',
		targetId: userId,
		detail: {
			desc: `${operatorName} 重新启用了用户「${targetUser.name}」`,
			targetName: targetUser.name,
		},
	})

	return ok(null, `用户「${targetUser.name}」已重新启用`)
})
