import { z } from 'zod'

/** 创建组 */
export const groupCreateSchema = z.object({
	name: z.string().min(1, '组名称不能为空').max(150, '组名称最多 150 字'),
	description: z.string().max(500, '描述最多 500 字').optional(),
	scopeType: z.number().int().min(1).max(3),
	scopeRefId: z.number().int().positive().optional(),
	parentId: z.number().int().positive().optional(),
})
export type GroupCreateBody = z.infer<typeof groupCreateSchema>

/** 编辑组 */
export const groupUpdateSchema = z.object({
	name: z.string().min(1, '组名称不能为空').max(150, '组名称最多 150 字').optional(),
	description: z.string().max(500, '描述最多 500 字').optional(),
})
export type GroupUpdateBody = z.infer<typeof groupUpdateSchema>
