import { describe, it, expect } from 'vitest'
import { addMembersSchema, updateMemberRoleSchema } from '~/server/schemas/group-member'

describe('addMembersSchema', () => {
	it('接受合法的批量添加参数', () => {
		const result = addMembersSchema.safeParse({
			members: [
				{ userId: 10001, role: 3 },
				{ userId: 10002, role: 1 },
			],
		})
		expect(result.success).toBe(true)
	})

	it('接受单个成员', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: 10001, role: 2 }],
		})
		expect(result.success).toBe(true)
	})

	it('拒绝空 members 数组', () => {
		const result = addMembersSchema.safeParse({ members: [] })
		expect(result.success).toBe(false)
	})

	it('拒绝超过 50 个成员', () => {
		const members = Array.from({ length: 51 }, (_, i) => ({ userId: i + 1, role: 3 }))
		const result = addMembersSchema.safeParse({ members })
		expect(result.success).toBe(false)
	})

	it('拒绝无效 role 值', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: 10001, role: 4 }],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝 role=0', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: 10001, role: 0 }],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝负数 userId', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: -1, role: 1 }],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝小数 userId', () => {
		const result = addMembersSchema.safeParse({
			members: [{ userId: 1.5, role: 1 }],
		})
		expect(result.success).toBe(false)
	})
})

describe('updateMemberRoleSchema', () => {
	it('接受合法 role', () => {
		expect(updateMemberRoleSchema.safeParse({ role: 1 }).success).toBe(true)
		expect(updateMemberRoleSchema.safeParse({ role: 2 }).success).toBe(true)
		expect(updateMemberRoleSchema.safeParse({ role: 3 }).success).toBe(true)
	})

	it('拒绝无效 role', () => {
		expect(updateMemberRoleSchema.safeParse({ role: 0 }).success).toBe(false)
		expect(updateMemberRoleSchema.safeParse({ role: 4 }).success).toBe(false)
	})

	it('拒绝缺少 role', () => {
		expect(updateMemberRoleSchema.safeParse({}).success).toBe(false)
	})
})
