import { z } from 'zod'

/** POST /api/share/create — 创建分享链接 */
export const createShareSchema = z.object({
	documentId: z.number().int().positive(),
	/** 2=可编辑, 4=可阅读 */
	permission: z.union([z.literal(2), z.literal(4)]),
})

export type CreateShareBody = z.infer<typeof createShareSchema>
