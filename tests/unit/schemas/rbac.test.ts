import { describe, it, expect } from 'vitest'
import {
	roleCreateSchema,
	roleUpdateSchema,
	rolePermissionsSchema,
	userRoleAssignSchema,
	userRoleRevokeSchema,
	roleListQuerySchema,
	userRoleListQuerySchema,
	userSearchQuerySchema,
} from '~/server/schemas/rbac'

describe('roleCreateSchema', () => {
	it('接受合法参数', () => {
		const result = roleCreateSchema.safeParse({
			code: 'editor',
			name: '编辑者',
			description: '可编辑文档',
			status: 1,
		})
		expect(result.success).toBe(true)
	})

	it('接受最小必填参数（description 和 status 有默认值）', () => {
		const result = roleCreateSchema.safeParse({
			code: 'viewer',
			name: '查看者',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.description).toBe('')
			expect(result.data.status).toBe(1)
		}
	})

	it('拒绝大写字母的 code', () => {
		const result = roleCreateSchema.safeParse({
			code: 'Editor',
			name: '编辑者',
		})
		expect(result.success).toBe(false)
	})

	it('拒绝数字开头的 code', () => {
		const result = roleCreateSchema.safeParse({
			code: '1editor',
			name: '编辑者',
		})
		expect(result.success).toBe(false)
	})

	it('拒绝单字符 code（最少 2 位）', () => {
		const result = roleCreateSchema.safeParse({
			code: 'e',
			name: '编辑者',
		})
		expect(result.success).toBe(false)
	})

	it('拒绝空 name', () => {
		const result = roleCreateSchema.safeParse({
			code: 'editor',
			name: '',
		})
		expect(result.success).toBe(false)
	})

	it('仅允许 status 为 0 或 1', () => {
		const result = roleCreateSchema.safeParse({
			code: 'editor',
			name: '编辑者',
			status: 2,
		})
		expect(result.success).toBe(false)
	})
})

describe('roleUpdateSchema', () => {
	it('接受合法参数', () => {
		const result = roleUpdateSchema.safeParse({
			name: '新名称',
			description: '新描述',
			status: 0,
		})
		expect(result.success).toBe(true)
	})

	it('拒绝空 name', () => {
		const result = roleUpdateSchema.safeParse({
			name: '',
		})
		expect(result.success).toBe(false)
	})
})

describe('rolePermissionsSchema', () => {
	it('接受合法权限 ID 数组', () => {
		const result = rolePermissionsSchema.safeParse({
			permissionIds: [1, 2, 3],
		})
		expect(result.success).toBe(true)
	})

	it('拒绝非数组', () => {
		const result = rolePermissionsSchema.safeParse({
			permissionIds: 'not-array',
		})
		expect(result.success).toBe(false)
	})

	it('拒绝负数 ID', () => {
		const result = rolePermissionsSchema.safeParse({
			permissionIds: [-1, 2],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝浮点数 ID', () => {
		const result = rolePermissionsSchema.safeParse({
			permissionIds: [1.5],
		})
		expect(result.success).toBe(false)
	})
})

describe('userRoleAssignSchema', () => {
	it('接受合法参数', () => {
		const result = userRoleAssignSchema.safeParse({
			userId: 1,
			roleId: 2,
		})
		expect(result.success).toBe(true)
	})

	it('拒绝非正整数 userId', () => {
		const result = userRoleAssignSchema.safeParse({
			userId: 0,
			roleId: 2,
		})
		expect(result.success).toBe(false)
	})

	it('拒绝缺失 roleId', () => {
		const result = userRoleAssignSchema.safeParse({
			userId: 1,
		})
		expect(result.success).toBe(false)
	})
})

describe('userRoleRevokeSchema', () => {
	it('接受合法参数', () => {
		const result = userRoleRevokeSchema.safeParse({
			userId: 1,
			roleId: 2,
		})
		expect(result.success).toBe(true)
	})
})

describe('roleListQuerySchema', () => {
	it('提供默认值', () => {
		const result = roleListQuerySchema.safeParse({})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.page).toBe(1)
			expect(result.data.pageSize).toBe(20)
			expect(result.data.keyword).toBe('')
		}
	})

	it('字符串数字被 coerce 为 number', () => {
		const result = roleListQuerySchema.safeParse({
			page: '3',
			pageSize: '10',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.page).toBe(3)
			expect(result.data.pageSize).toBe(10)
		}
	})

	it('拒绝 pageSize 超过 100', () => {
		const result = roleListQuerySchema.safeParse({
			pageSize: '200',
		})
		expect(result.success).toBe(false)
	})
})

describe('userRoleListQuerySchema', () => {
	it('提供默认值', () => {
		const result = userRoleListQuerySchema.safeParse({})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.page).toBe(1)
			expect(result.data.pageSize).toBe(20)
			expect(result.data.keyword).toBe('')
			expect(result.data.roleId).toBeUndefined()
		}
	})

	it('解析 roleId', () => {
		const result = userRoleListQuerySchema.safeParse({ roleId: '5' })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.roleId).toBe(5)
		}
	})
})

describe('userSearchQuerySchema', () => {
	it('提供默认值', () => {
		const result = userSearchQuerySchema.safeParse({})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.keyword).toBe('')
		}
	})
})
