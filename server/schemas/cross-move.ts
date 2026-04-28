import { z } from 'zod'

/** POST /api/documents/:id/move — 发起跨组移动 */
export const crossMoveRequestSchema = z.object({
	targetGroupId: z.number().int().positive('目标组 ID 非法'),
})

/** PUT /api/documents/cross-move/:id/review — 审核跨组移动 */
export const crossMoveReviewSchema = z.object({
	action: z.enum(['approve', 'reject']),
})

export type CrossMoveRequestBody = z.infer<typeof crossMoveRequestSchema>
export type CrossMoveReviewBody = z.infer<typeof crossMoveReviewSchema>
