import { z } from 'zod'

const memberRoleSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])

/** 批量添加成员 */
export const addMembersSchema = z.object({
	members: z.array(z.object({
		userId: z.number().int().positive(),
		role: memberRoleSchema,
	})).min(1).max(50),
})

/** 修改成员权限 */
export const updateMemberRoleSchema = z.object({
	role: memberRoleSchema,
})

export type AddMembersBody = z.infer<typeof addMembersSchema>
export type UpdateMemberRoleBody = z.infer<typeof updateMemberRoleSchema>
