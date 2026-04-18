import { z } from 'zod'

/**
 * query 参数中布尔值强制转换：
 * HTTP query 参数全部是字符串，z.coerce.boolean() 在 Zod v4
 * 中会把非空字符串（含 'false'）均转为 true，需手动处理。
 */
const queryBoolean = z
	.string()
	.transform((v) => v === 'true')
	.or(z.boolean())
	.default(false)

/** GET /api/notifications 查询参数 */
export const notificationListQuerySchema = z.object({
	category: z.coerce.number().int().min(1).max(3).optional(),
	onlyUnread: queryBoolean,
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// readAllBodySchema 走 PUT body（JSON），category 天然是 number，
// 不同于 listQuery 来自 query string 需 coerce。
export const readAllBodySchema = z.object({
	category: z.number().int().min(1).max(3).optional(),
})

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>
export type ReadAllBody = z.infer<typeof readAllBodySchema>
