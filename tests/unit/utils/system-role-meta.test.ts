import { describe, it, expect } from 'vitest'
import {
	SYSTEM_ROLE_META, getRoleMeta,
	ROLE_FILTER_OPTIONS, STATUS_FILTER_OPTIONS,
} from '~/utils/system-role-meta'
import type { AdminSystemRoleCode } from '~/types/admin'

describe('SYSTEM_ROLE_META', () => {
	it('覆盖 4 个系统角色', () => {
		expect(Object.keys(SYSTEM_ROLE_META).sort()).toEqual(
			['company_admin', 'dept_head', 'pl_head', 'super_admin'],
		)
	})

	it('dept_head 标记 feishuSynced=true，其他为 false/undefined', () => {
		expect(SYSTEM_ROLE_META.dept_head.feishuSynced).toBe(true)
		expect(SYSTEM_ROLE_META.super_admin.feishuSynced).toBeFalsy()
		expect(SYSTEM_ROLE_META.company_admin.feishuSynced).toBeFalsy()
		expect(SYSTEM_ROLE_META.pl_head.feishuSynced).toBeFalsy()
	})

	it('每个角色都有 label / color / bg', () => {
		for (const code of Object.keys(SYSTEM_ROLE_META) as AdminSystemRoleCode[]) {
			const meta = SYSTEM_ROLE_META[code]
			expect(meta.label).toBeTruthy()
			expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/)
			expect(meta.bg).toMatch(/^#[0-9a-fA-F]{6}$/)
		}
	})
})

describe('getRoleMeta', () => {
	it('返回已知角色的 meta', () => {
		expect(getRoleMeta('super_admin').label).toBe('系统管理员')
		expect(getRoleMeta('company_admin').label).toBe('公司层管理员')
		expect(getRoleMeta('pl_head').label).toBe('产品线负责人')
		expect(getRoleMeta('dept_head').label).toBe('部门负责人')
	})

	it('未知角色 code 兜底为灰色', () => {
		// @ts-expect-error 故意传非法值测试兜底
		const meta = getRoleMeta('unknown_role')
		expect(meta.label).toBe('unknown_role')
		expect(meta.color).toBe('#6b7280')
	})
})

describe('ROLE_FILTER_OPTIONS', () => {
	it('包含 4 个系统角色 + none', () => {
		const values = ROLE_FILTER_OPTIONS.map(o => o.value).sort()
		expect(values).toEqual(['company_admin', 'dept_head', 'none', 'pl_head', 'super_admin'])
	})

	it('none 选项 label 为「无系统角色」', () => {
		const none = ROLE_FILTER_OPTIONS.find(o => o.value === 'none')
		expect(none?.label).toBe('无系统角色')
	})
})

describe('STATUS_FILTER_OPTIONS', () => {
	it('三个状态筛选', () => {
		const values = STATUS_FILTER_OPTIONS.map(o => o.value).sort()
		expect(values).toEqual(['active', 'all', 'deactivated'])
	})
})
