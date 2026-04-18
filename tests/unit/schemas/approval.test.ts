import { describe, it, expect } from 'vitest'
import { approvalListQuerySchema } from '~/server/schemas/approval'

describe('approvalListQuerySchema', () => {
	describe('合法参数', () => {
		it('三种 tab 均接受', () => {
			expect(approvalListQuerySchema.safeParse({ tab: 'pending' }).success).toBe(true)
			expect(approvalListQuerySchema.safeParse({ tab: 'submitted' }).success).toBe(true)
			expect(approvalListQuerySchema.safeParse({ tab: 'handled' }).success).toBe(true)
		})

		it('status 取可筛选的 4 个值均合法', () => {
			for (const s of [2, 3, 4, 5]) {
				expect(approvalListQuerySchema.safeParse({ tab: 'submitted', status: s }).success).toBe(true)
			}
		})

		it('省略可选字段用默认值', () => {
			const r = approvalListQuerySchema.safeParse({ tab: 'pending' })
			expect(r.success).toBe(true)
			if (r.success) {
				expect(r.data.page).toBe(1)
				expect(r.data.pageSize).toBe(10)
				expect(r.data.status).toBeUndefined()
			}
		})

		it('字符串 status / page / pageSize 由 coerce 转数字', () => {
			const r = approvalListQuerySchema.safeParse({
				tab: 'handled', status: '3', page: '2', pageSize: '30',
			})
			expect(r.success).toBe(true)
			if (r.success) {
				expect(r.data.status).toBe(3)
				expect(r.data.page).toBe(2)
				expect(r.data.pageSize).toBe(30)
			}
		})
	})

	describe('非法参数', () => {
		it('缺 tab', () => {
			expect(approvalListQuerySchema.safeParse({}).success).toBe(false)
		})

		it('tab 取未知值', () => {
			expect(approvalListQuerySchema.safeParse({ tab: 'xxx' }).success).toBe(false)
		})

		it('status=1（待审批）不在可筛选集合内', () => {
			// PRD 中"待审批"是流程中间态，用户侧不应作为筛选项
			expect(approvalListQuerySchema.safeParse({ tab: 'submitted', status: 1 }).success).toBe(false)
		})

		it('status 取未知值', () => {
			expect(approvalListQuerySchema.safeParse({ tab: 'submitted', status: 99 }).success).toBe(false)
		})

		it('page <= 0', () => {
			expect(approvalListQuerySchema.safeParse({ tab: 'pending', page: 0 }).success).toBe(false)
			expect(approvalListQuerySchema.safeParse({ tab: 'pending', page: -1 }).success).toBe(false)
		})

		it('pageSize 超限', () => {
			expect(approvalListQuerySchema.safeParse({ tab: 'pending', pageSize: 0 }).success).toBe(false)
			expect(approvalListQuerySchema.safeParse({ tab: 'pending', pageSize: 101 }).success).toBe(false)
		})
	})

	describe('边界值', () => {
		it('pageSize=1 / =100 合法', () => {
			expect(approvalListQuerySchema.safeParse({ tab: 'pending', pageSize: 1 }).success).toBe(true)
			expect(approvalListQuerySchema.safeParse({ tab: 'pending', pageSize: 100 }).success).toBe(true)
		})
	})
})
