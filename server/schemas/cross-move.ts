import { z } from 'zod'

/** POST /api/documents/:id/move — 发起跨组移动 */
export const crossMoveRequestSchema = z.object({
	targetGroupId: z.number().int().positive('目标组 ID 非法'),
})

/** POST /api/documents/batch-move — 批量跨组移动 */
export const batchMoveRequestSchema = z.object({
	documentIds: z.array(z.number().int().positive()).min(1).max(50),
	targetGroupId: z.number().int().positive('目标组 ID 非法'),
})

/** PUT /api/documents/cross-move/:id/review — 审核跨组移动 */
export const crossMoveReviewSchema = z.object({
	action: z.enum(['approve', 'reject']),
})

export type CrossMoveRequestBody = z.infer<typeof crossMoveRequestSchema>
export type BatchMoveRequestBody = z.infer<typeof batchMoveRequestSchema>
export type CrossMoveReviewBody = z.infer<typeof crossMoveReviewSchema>
