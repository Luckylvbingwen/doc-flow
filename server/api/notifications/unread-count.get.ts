/**
 * GET /api/notifications/unread-count
 * 当前用户未读通知计数（总数 + 按分类）
 *
 * 不挂 requirePermission，仅以 event.context.user.id 过滤 user_id
 */
import { prisma } from '~/server/utils/prisma'
import type { UnreadCountResp } from '~/server/types/notification'

export default defineEventHandler(async (event) => {
	const userId = BigInt(event.context.user.id)

	// 一次 GROUP BY category 拿全部分类未读数
	const rows = await prisma.$queryRaw<Array<{ category: number, cnt: bigint }>>`
		SELECT category, COUNT(*) AS cnt
		FROM doc_notifications
		WHERE user_id = ${userId} AND read_at IS NULL
		GROUP BY category
	`

	const byCategory: UnreadCountResp['byCategory'] = { '1': 0, '2': 0, '3': 0 }
	let total = 0
	for (const r of rows) {
		const c = String(r.category) as '1' | '2' | '3'
		const cnt = Number(r.cnt)
		byCategory[c] = cnt
		total += cnt
	}

	return ok({ total, byCategory })
})
