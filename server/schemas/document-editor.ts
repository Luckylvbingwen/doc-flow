import { z } from 'zod'

const TITLE_REGEX = /^[^/\\:*?"<>|]*$/

export const createDraftSchema = z.object({
	title: z.string().min(1).max(100).regex(TITLE_REGEX, '标题不能包含 /:*?"<>| 等特殊字符').default('未命名文档'),
	groupId: z.number().int().positive().optional(),
})

export const saveContentSchema = z.object({
	content: z.string(),
	title: z.string().min(1).max(100).regex(TITLE_REGEX, '标题不能包含 /:*?"<>| 等特殊字符').optional(),
})

export const createEditCopySchema = z.object({})  // body 为空，docId 从路由取

export type CreateDraftBody = z.infer<typeof createDraftSchema>
export type SaveContentBody = z.infer<typeof saveContentSchema>
