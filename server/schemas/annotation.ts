import { z } from 'zod'

export const createAnnotationSchema = z.object({
	content: z.string().min(1).max(2000),
	quoteText: z.string().max(500).default(''),
	anchorData: z.record(z.string(), z.unknown()).default({}),
})

export const updateAnnotationSchema = z.object({
	content: z.string().min(1).max(2000).optional(),
	status: z.literal(2).optional(), // 2=已解决
})
