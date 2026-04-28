import { z } from 'zod'

/** POST /api/documents/:id/comments — 新增评论 */
export const createCommentSchema = z.object({
	content: z.string().min(1, '评论内容不能为空').max(2000, '评论内容不能超过 2000 字'),
	parentId: z.number().int().positive().optional(),
})

export type CreateCommentBody = z.infer<typeof createCommentSchema>
