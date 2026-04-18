/**
 * PUT /api/notifications/:id/read
 * 标记单条通知为已读（幂等，仅 owner 可操作）
 *
 * 操作后推 WS badge 给该用户，更新客户端未读数
 */
import { prisma } from '~/server/utils/prisma'
import { pushBadgeToUser } from '~/server/utils/notify'

export default defineEventHandler(async (event) => {
	const idParam = getRouterParam(event, 'id')
	if (!idParam || !/^\d+$/.test(idParam)) {
		return fail(event, 400, 'BAD_REQUEST', '无效的通知 ID')
	}
	const id = BigInt(idParam)
	const userId = BigInt(event.context.user.id)

	const existing = await prisma.doc_notifications.findFirst({
		where: { id, user_id: userId },
		select: { id: true, read_at: true },
	})
	if (!existing) {
		return fail(event, 404, 'NOT_FOUND', '通知不存在')
	}

	// 已读幂等：已读不覆盖 read_at
	if (existing.read_at === null) {
		await prisma.doc_notifications.update({
			where: { id },
			data: { read_at: new Date() },
		})
	}

	await pushBadgeToUser(userId)
	return ok({})
})
