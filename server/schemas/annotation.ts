import { z } from 'zod'

export const createAnnotationSchema = z.object({
	content: z.string().trim().min(1).max(1000),
	quoteText: z.string().max(500).default(''),
	anchorData: z.record(z.string(), z.unknown()).default({}),
	mentionedUserIds: z.array(z.number()).max(20).default([]),
})

export const updateAnnotationSchema = z.object({
	content: z.string().trim().min(1).max(1000).optional(),
	status: z.literal(2).optional(), // 2=已解决
})

export const createReplySchema = z.object({
	content: z.string().trim().min(1).max(1000),
	mentionedUserIds: z.array(z.number()).max(20).default([]),
})
