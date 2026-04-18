/**
 * GET /api/notifications
 * 通知列表（当前用户，分页）
 *
 * 查询参数见 server/schemas/notification.ts
 * 不挂 requirePermission，仅以 event.context.user.id 过滤 user_id
 */
import { prisma } from '~/server/utils/prisma'
import { notificationListQuerySchema } from '~/server/schemas/notification'
import type { NotificationItem, NotificationCategory, NotificationBizType } from '~/server/types/notification'

export default defineEventHandler(async (event) => {
	const query = await getValidatedQuery(event, notificationListQuerySchema.parse)
	const userId = BigInt(event.context.user.id)

	const where: {
		user_id: bigint
		category?: number
		read_at?: null
	} = { user_id: userId }
	if (query.category !== undefined) where.category = query.category
	if (query.onlyUnread) where.read_at = null

	const [total, rows] = await Promise.all([
		prisma.doc_notifications.count({ where }),
		prisma.doc_notifications.findMany({
			where,
			orderBy: { created_at: 'desc' },
			skip: (query.page - 1) * query.pageSize,
			take: query.pageSize,
		}),
	])

	const list: NotificationItem[] = rows.map(r => ({
		id: r.id.toString(),
		category: r.category as NotificationCategory,
		msgCode: r.msg_code,
		title: r.title,
		content: r.content,
		bizType: r.biz_type as NotificationBizType | null,
		bizId: r.biz_id ? r.biz_id.toString() : null,
		read: r.read_at !== null,
		readAt: r.read_at ? r.read_at.getTime() : null,
		createdAt: r.created_at.getTime(),
	}))

	return ok({ list, total, page: query.page, pageSize: query.pageSize })
})
