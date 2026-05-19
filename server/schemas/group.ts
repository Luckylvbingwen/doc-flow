import { z } from 'zod'

/** 禁止出现在组名称中的特殊字符 */
const GROUP_NAME_REGEX = /^[^/\\:?"<>|]*$/

/** 创建组 */
export const groupCreateSchema = z.object({
	name: z.string().min(1, '组名称不能为空').max(50, '组名称最多 50 字').regex(GROUP_NAME_REGEX, '组名称不能包含 /:?"<>| 等特殊字符'),
	description: z.string().max(200, '描述最多 200 字').optional(),
	scopeType: z.number().int().min(1).max(3),
	scopeRefId: z.number().int().positive().optional(),
	parentId: z.number().int().positive().optional(),
})
export type GroupCreateBody = z.infer<typeof groupCreateSchema>

/** 编辑组 */
export const groupUpdateSchema = z.object({
	name: z.string().min(1, '组名称不能为空').max(50, '组名称最多 50 字').regex(GROUP_NAME_REGEX, '组名称不能包含 /:?"<>| 等特殊字符').optional(),
	description: z.string().max(200, '描述最多 200 字').optional(),
	ownerId: z.number().int().positive().optional(),
})
export type GroupUpdateBody = z.infer<typeof groupUpdateSchema>

/** 飞书文档导入 */
export const feishuImportSchema = z.object({
	feishuUrl: z.string().url('请输入有效的飞书文档链接').max(500),
	changeNote: z.string().max(500).optional(),
})
