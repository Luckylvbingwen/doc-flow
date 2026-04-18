/**
 * PUT /api/notifications/read-all
 * 批量标记已读（当前用户，可选按 category 过滤）
 *
 * 操作后推 WS badge 给该用户，更新客户端未读数
 */
import { prisma } from '~/server/utils/prisma'
import { pushBadgeToUser } from '~/server/utils/notify'
import { readAllBodySchema } from '~/server/schemas/notification'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, readAllBodySchema.parse)
	const userId = BigInt(event.context.user.id)

	const where: { user_id: bigint, read_at: null, category?: number } = {
		user_id: userId,
		read_at: null,
	}
	if (body.category !== undefined) where.category = body.category

	const result = await prisma.doc_notifications.updateMany({
		where,
		data: { read_at: new Date() },
	})

	await pushBadgeToUser(userId)
	return ok({ updated: result.count })
})
