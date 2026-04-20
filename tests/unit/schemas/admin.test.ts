import { describe, it, expect } from 'vitest'
import {
	adminUserListQuerySchema, adminRoleAssignBodySchema,
} from '~/server/schemas/admin'

describe('adminUserListQuerySchema', () => {
	describe('合法参数', () => {
		it('全部省略走默认值', () => {
			const r = adminUserListQuerySchema.safeParse({})
			expect(r.success).toBe(true)
			if (r.success) {
				expect(r.data.page).toBe(1)
				expect(r.data.pageSize).toBe(20)
				expect(r.data.status).toBe('all')
				expect(r.data.keyword).toBeUndefined()
				expect(r.data.roles).toBeUndefined()
			}
		})

		it('status 三个值可选', () => {
			for (const s of ['all', 'active', 'deactivated']) {
				expect(adminUserListQuerySchema.safeParse({ status: s }).success).toBe(true)
			}
		})

		it('roles 字符串自动 split', () => {
			const r = adminUserListQuerySchema.safeParse({ roles: 'super_admin,company_admin' })
			expect(r.success).toBe(true)
			if (r.success) expect(r.data.roles).toEqual(['super_admin', 'company_admin'])
		})

		it('roles 数组形式直接接收', () => {
			const r = adminUserListQuerySchema.safeParse({ roles: ['pl_head', 'none'] })
			expect(r.success).toBe(true)
			if (r.success) expect(r.data.roles).toEqual(['pl_head', 'none'])
		})

		it('roles 支持 none 值', () => {
			const r = adminUserListQuerySchema.safeParse({ roles: 'none' })
			expect(r.success).toBe(true)
			if (r.success) expect(r.data.roles).toEqual(['none'])
		})

		it('page / pageSize 字符串走 coerce', () => {
			const r = adminUserListQuerySchema.safeParse({ page: '3', pageSize: '50' })
			expect(r.success).toBe(true)
			if (r.success) {
				expect(r.data.page).toBe(3)
				expect(r.data.pageSize).toBe(50)
			}
		})

		it('keyword 自动 trim', () => {
			const r = adminUserListQuerySchema.safeParse({ keyword: '  张  ' })
			expect(r.success).toBe(true)
			if (r.success) expect(r.data.keyword).toBe('张')
		})
	})

	describe('非法参数', () => {
		it('status 取未知值', () => {
			expect(adminUserListQuerySchema.safeParse({ status: 'xxx' }).success).toBe(false)
		})

		it('roles 取未知角色 code', () => {
			expect(adminUserListQuerySchema.safeParse({ roles: 'random_role' }).success).toBe(false)
		})

		it('page = 0 / 负数', () => {
			expect(adminUserListQuerySchema.safeParse({ page: 0 }).success).toBe(false)
			expect(adminUserListQuerySchema.safeParse({ page: -1 }).success).toBe(false)
		})

		it('pageSize > 100', () => {
			expect(adminUserListQuerySchema.safeParse({ pageSize: 200 }).success).toBe(false)
		})

		it('keyword 长度超 100', () => {
			const long = 'a'.repeat(101)
			expect(adminUserListQuerySchema.safeParse({ keyword: long }).success).toBe(false)
		})
	})
})

describe('adminRoleAssignBodySchema', () => {
	describe('合法参数', () => {
		it('两个 boolean 同时 true', () => {
			const r = adminRoleAssignBodySchema.safeParse({ companyAdmin: true, plHead: true })
			expect(r.success).toBe(true)
		})

		it('两个 boolean 同时 false（撤销所有可指派角色）', () => {
			const r = adminRoleAssignBodySchema.safeParse({ companyAdmin: false, plHead: false })
			expect(r.success).toBe(true)
		})

		it('混合 true/false', () => {
			const r = adminRoleAssignBodySchema.safeParse({ companyAdmin: true, plHead: false })
			expect(r.success).toBe(true)
		})
	})

	describe('非法参数', () => {
		it('缺字段', () => {
			expect(adminRoleAssignBodySchema.safeParse({ companyAdmin: true }).success).toBe(false)
			expect(adminRoleAssignBodySchema.safeParse({ plHead: true }).success).toBe(false)
			expect(adminRoleAssignBodySchema.safeParse({}).success).toBe(false)
		})

		it('字段类型错误', () => {
			expect(adminRoleAssignBodySchema.safeParse({ companyAdmin: 'true', plHead: false }).success).toBe(false)
			expect(adminRoleAssignBodySchema.safeParse({ companyAdmin: true, plHead: 1 }).success).toBe(false)
		})
	})
})
