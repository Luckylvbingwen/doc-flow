import { z } from 'zod'

/** 创建产品线 */
export const productLineCreateSchema = z.object({
	name: z.string().min(1, '产品线名称不能为空').max(150, '产品线名称最多 150 字'),
	description: z.string().max(500, '描述最多 500 字').optional(),
})
export type ProductLineCreateBody = z.infer<typeof productLineCreateSchema>

/** 编辑产品线 */
export const productLineUpdateSchema = z.object({
	name: z.string().min(1, '产品线名称不能为空').max(150, '产品线名称最多 150 字').optional(),
	description: z.string().max(500, '描述最多 500 字').optional(),
})
export type ProductLineUpdateBody = z.infer<typeof productLineUpdateSchema>
