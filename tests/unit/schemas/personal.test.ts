import { describe, it, expect } from 'vitest'
import { personalListQuerySchema } from '~/server/schemas/personal'

describe('personalListQuerySchema', () => {
	describe('合法参数', () => {
		it('五个 tab 全部接受', () => {
			for (const tab of ['all', 'mine', 'shared', 'favorite', 'handover']) {
				expect(personalListQuerySchema.safeParse({ tab }).success).toBe(true)
			}
		})

		it('status 取 1-4 合法', () => {
			for (const status of [1, 2, 3, 4]) {
				expect(personalListQuerySchema.safeParse({ tab: 'mine', status }).success).toBe(true)
			}
		})

		it('省略可选字段走默认', () => {
			const r = personalListQuerySchema.safeParse({ tab: 'all' })
			expect(r.success).toBe(true)
			if (r.success) {
				expect(r.data.page).toBe(1)
				expect(r.data.pageSize).toBe(10)
				expect(r.data.status).toBeUndefined()
				expect(r.data.keyword).toBeUndefined()
			}
		})

		it('字符串 status/page/pageSize 走 coerce', () => {
			const r = personalListQuerySchema.safeParse({ tab: 'mine', status: '3', page: '2', pageSize: '20' })
			expect(r.success).toBe(true)
			if (r.success) {
				expect(r.data.status).toBe(3)
				expect(r.data.page).toBe(2)
				expect(r.data.pageSize).toBe(20)
			}
		})

		it('keyword 自动 trim', () => {
			const r = personalListQuerySchema.safeParse({ tab: 'mine', keyword: '  方案  ' })
			expect(r.success).toBe(true)
			if (r.success) expect(r.data.keyword).toBe('方案')
		})
	})

	describe('非法参数', () => {
		it('缺 tab', () => {
			expect(personalListQuerySchema.safeParse({}).success).toBe(false)
		})

		it('tab 取未知值', () => {
			expect(personalListQuerySchema.safeParse({ tab: 'xxx' }).success).toBe(false)
		})

		it('status=5 已驳回 / 6 已删除 不可筛选', () => {
			expect(personalListQuerySchema.safeParse({ tab: 'mine', status: 5 }).success).toBe(false)
			expect(personalListQuerySchema.safeParse({ tab: 'mine', status: 6 }).success).toBe(false)
		})

		it('status 取未知值', () => {
			expect(personalListQuerySchema.safeParse({ tab: 'mine', status: 99 }).success).toBe(false)
		})

		it('keyword 超 100 字符', () => {
			expect(personalListQuerySchema.safeParse({ tab: 'mine', keyword: 'x'.repeat(101) }).success).toBe(false)
		})

		it('page <= 0', () => {
			expect(personalListQuerySchema.safeParse({ tab: 'mine', page: 0 }).success).toBe(false)
		})

		it('pageSize 超限', () => {
			expect(personalListQuerySchema.safeParse({ tab: 'mine', pageSize: 101 }).success).toBe(false)
		})
	})

	describe('边界', () => {
		it('pageSize=1 和 100 合法', () => {
			expect(personalListQuerySchema.safeParse({ tab: 'mine', pageSize: 1 }).success).toBe(true)
			expect(personalListQuerySchema.safeParse({ tab: 'mine', pageSize: 100 }).success).toBe(true)
		})
	})
})
