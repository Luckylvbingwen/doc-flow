import { z } from 'zod'

/** 添加文档引用（批量） */
export const addReferencesSchema = z.object({
  documentIds: z.array(z.number().int().positive()).min(1).max(50),
})

/** 搜索可引用文档 */
export const searchReferencesQuerySchema = z.object({
  keyword: z.string().optional(),
  sourceGroupId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type AddReferencesBody = z.infer<typeof addReferencesSchema>
export type SearchReferencesQuery = z.infer<typeof searchReferencesQuerySchema>
