import { describe, it, expect } from 'vitest'
import {
	recycleListQuerySchema,
	recycleFilterGroupsQuerySchema,
	recycleBatchBodySchema,
} from '~/server/schemas/recycle-bin'

describe('recycleListQuerySchema', () => {
	describe('合法参数', () => {
		it('空对象走默认分页', () => {
			const result = recycleListQuerySchema.safeParse({})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.page).toBe(1)
				expect(result.data.pageSize).toBe(10)
			}
		})

		it('接受完整筛选', () => {
			const result = recycleListQuerySchema.safeParse({
				keyword: '方案',
				groupId: '40004',
				deletedBy: '10003',
				startAt: '2026-01-01',
				endAt: '2026-04-17',
				page: 2,
				pageSize: 30,
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.groupId).toBe(40004)
				expect(result.data.deletedBy).toBe(10003)
			}
		})

		it('开始日期与结束日期相等为合法', () => {
			const result = recycleListQuerySchema.safeParse({
				startAt: '2026-04-17', endAt: '2026-04-17',
			})
			expect(result.success).toBe(true)
		})

		it('keyword 被 trim', () => {
			const result = recycleListQuerySchema.safeParse({ keyword: '  方案  ' })
			expect(result.success).toBe(true)
			if (result.success) expect(result.data.keyword).toBe('方案')
		})
	})

	describe('非法参数', () => {
		it('拒绝非 YYYY-MM-DD 日期', () => {
			expect(recycleListQuerySchema.safeParse({ startAt: '2026/01/01' }).success).toBe(false)
			expect(recycleListQuerySchema.safeParse({ endAt: '26-01-01' }).success).toBe(false)
		})

		it('拒绝开始日期晚于结束日期', () => {
			const result = recycleListQuerySchema.safeParse({
				startAt: '2026-04-18', endAt: '2026-04-17',
			})
			expect(result.success).toBe(false)
		})

		it('拒绝 groupId <= 0', () => {
			expect(recycleListQuerySchema.safeParse({ groupId: 0 }).success).toBe(false)
			expect(recycleListQuerySchema.safeParse({ groupId: -1 }).success).toBe(false)
		})

		it('拒绝 pageSize 超限', () => {
			expect(recycleListQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false)
			expect(recycleListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
		})

		it('拒绝 keyword 超 100 字符', () => {
			expect(recycleListQuerySchema.safeParse({ keyword: 'x'.repeat(101) }).success).toBe(false)
		})
	})
})

describe('recycleFilterGroupsQuerySchema', () => {
	it('空对象使用默认分页（pageSize=20）', () => {
		const result = recycleFilterGroupsQuerySchema.safeParse({})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.page).toBe(1)
			expect(result.data.pageSize).toBe(20)
		}
	})

	it('接受完整参数', () => {
		const result = recycleFilterGroupsQuerySchema.safeParse({
			keyword: '研发', page: 2, pageSize: 50,
		})
		expect(result.success).toBe(true)
	})

	it('拒绝 pageSize > 100', () => {
		expect(recycleFilterGroupsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
	})
})

describe('recycleBatchBodySchema', () => {
	it('接受 1 个 id', () => {
		const result = recycleBatchBodySchema.safeParse({ ids: [50005] })
		expect(result.success).toBe(true)
	})

	it('接受 50 个 id', () => {
		const ids = Array.from({ length: 50 }, (_, i) => 50000 + i)
		expect(recycleBatchBodySchema.safeParse({ ids }).success).toBe(true)
	})

	it('字符串 id 由 coerce 转为数字', () => {
		const result = recycleBatchBodySchema.safeParse({ ids: ['50005', '50006'] })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.ids).toEqual([50005, 50006])
		}
	})

	it('拒绝空数组', () => {
		expect(recycleBatchBodySchema.safeParse({ ids: [] }).success).toBe(false)
	})

	it('拒绝超过 50 个 id', () => {
		const ids = Array.from({ length: 51 }, (_, i) => 50000 + i)
		expect(recycleBatchBodySchema.safeParse({ ids }).success).toBe(false)
	})

	it('拒绝非正整数 id', () => {
		expect(recycleBatchBodySchema.safeParse({ ids: [0] }).success).toBe(false)
		expect(recycleBatchBodySchema.safeParse({ ids: [-5] }).success).toBe(false)
	})
})
