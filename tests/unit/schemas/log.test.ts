import { describe, it, expect } from 'vitest'
import { logListQuerySchema } from '~/server/schemas/log'

describe('logListQuerySchema', () => {
	describe('合法参数', () => {
		it('空对象走默认值', () => {
			const result = logListQuerySchema.safeParse({})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.page).toBe(1)
				expect(result.data.pageSize).toBe(10)
			}
		})

		it('接受完整参数', () => {
			const result = logListQuerySchema.safeParse({
				type: 'file_upload',
				keyword: '审批人',
				startAt: '2026-01-01',
				endAt: '2026-04-17',
				page: 2,
				pageSize: 30,
			})
			expect(result.success).toBe(true)
		})

		it('数字字段接受字符串（由 z.coerce.number 转换）', () => {
			const result = logListQuerySchema.safeParse({ page: '3', pageSize: '50' })
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.page).toBe(3)
				expect(result.data.pageSize).toBe(50)
			}
		})

		it('开始日期与结束日期相等为合法', () => {
			const result = logListQuerySchema.safeParse({
				startAt: '2026-04-17', endAt: '2026-04-17',
			})
			expect(result.success).toBe(true)
		})
	})

	describe('非法参数', () => {
		it('拒绝未知 type', () => {
			const result = logListQuerySchema.safeParse({ type: 'unknown_type' })
			expect(result.success).toBe(false)
		})

		it('拒绝非 YYYY-MM-DD 格式日期', () => {
			expect(logListQuerySchema.safeParse({ startAt: '2026/01/01' }).success).toBe(false)
			expect(logListQuerySchema.safeParse({ startAt: '26-01-01' }).success).toBe(false)
			expect(logListQuerySchema.safeParse({ endAt: '2026-1-1' }).success).toBe(false)
		})

		it('拒绝开始日期晚于结束日期', () => {
			const result = logListQuerySchema.safeParse({
				startAt: '2026-04-18', endAt: '2026-04-17',
			})
			expect(result.success).toBe(false)
		})

		it('拒绝 page <= 0', () => {
			expect(logListQuerySchema.safeParse({ page: 0 }).success).toBe(false)
			expect(logListQuerySchema.safeParse({ page: -1 }).success).toBe(false)
		})

		it('拒绝 pageSize 超限', () => {
			expect(logListQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false)
			expect(logListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
		})

		it('拒绝 keyword 超过 100 字符', () => {
			const result = logListQuerySchema.safeParse({ keyword: 'x'.repeat(101) })
			expect(result.success).toBe(false)
		})
	})

	describe('边界值', () => {
		it('pageSize=1 合法', () => {
			expect(logListQuerySchema.safeParse({ pageSize: 1 }).success).toBe(true)
		})
		it('pageSize=100 合法', () => {
			expect(logListQuerySchema.safeParse({ pageSize: 100 }).success).toBe(true)
		})
		it('keyword=100 字符合法', () => {
			expect(logListQuerySchema.safeParse({ keyword: 'x'.repeat(100) }).success).toBe(true)
		})
		it('keyword 被 trim', () => {
			const result = logListQuerySchema.safeParse({ keyword: '  hello  ' })
			expect(result.success).toBe(true)
			if (result.success) expect(result.data.keyword).toBe('hello')
		})
	})
})
