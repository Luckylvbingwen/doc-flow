import { describe, it, expect } from 'vitest'
import { notificationListQuerySchema, readAllBodySchema } from '~/server/schemas/notification'

describe('notificationListQuerySchema', () => {
	it('使用全部默认值', () => {
		const r = notificationListQuerySchema.safeParse({})
		expect(r.success).toBe(true)
		if (r.success) {
			expect(r.data.page).toBe(1)
			expect(r.data.pageSize).toBe(20)
			expect(r.data.onlyUnread).toBe(false)
			expect(r.data.category).toBeUndefined()
		}
	})

	it('接受合法 category=1', () => {
		const r = notificationListQuerySchema.safeParse({ category: '1' })
		expect(r.success).toBe(true)
		if (r.success) expect(r.data.category).toBe(1)
	})

	it('接受 category=2 和 category=3', () => {
		expect(notificationListQuerySchema.safeParse({ category: '2' }).success).toBe(true)
		expect(notificationListQuerySchema.safeParse({ category: '3' }).success).toBe(true)
	})

	it('拒绝非法 category=4', () => {
		const r = notificationListQuerySchema.safeParse({ category: '4' })
		expect(r.success).toBe(false)
	})

	it('拒绝 category=0', () => {
		const r = notificationListQuerySchema.safeParse({ category: '0' })
		expect(r.success).toBe(false)
	})

	it('onlyUnread 字符串 true/false 强制转换', () => {
		const a = notificationListQuerySchema.safeParse({ onlyUnread: 'true' })
		expect(a.success).toBe(true)
		if (a.success) expect(a.data.onlyUnread).toBe(true)

		const b = notificationListQuerySchema.safeParse({ onlyUnread: 'false' })
		expect(b.success).toBe(true)
		if (b.success) expect(b.data.onlyUnread).toBe(false)
	})

	it('pageSize 上限 100', () => {
		const ok = notificationListQuerySchema.safeParse({ pageSize: '100' })
		expect(ok.success).toBe(true)
		const bad = notificationListQuerySchema.safeParse({ pageSize: '101' })
		expect(bad.success).toBe(false)
	})

	it('pageSize 下限 1', () => {
		const bad = notificationListQuerySchema.safeParse({ pageSize: '0' })
		expect(bad.success).toBe(false)
	})

	it('page 下限 1', () => {
		const bad = notificationListQuerySchema.safeParse({ page: '0' })
		expect(bad.success).toBe(false)
	})

	it('拒绝 pageSize 负数', () => {
		const bad = notificationListQuerySchema.safeParse({ pageSize: '-1' })
		expect(bad.success).toBe(false)
	})

	it('拒绝 page 负数', () => {
		const bad = notificationListQuerySchema.safeParse({ page: '-1' })
		expect(bad.success).toBe(false)
	})

	it('pageSize=1 合法（下限）', () => {
		const r = notificationListQuerySchema.safeParse({ pageSize: '1' })
		expect(r.success).toBe(true)
		if (r.success) expect(r.data.pageSize).toBe(1)
	})
})

describe('readAllBodySchema', () => {
	it('不传 category 通过（全部分类）', () => {
		const r = readAllBodySchema.safeParse({})
		expect(r.success).toBe(true)
		if (r.success) expect(r.data.category).toBeUndefined()
	})

	it('合法 category=1/2/3 通过', () => {
		expect(readAllBodySchema.safeParse({ category: 1 }).success).toBe(true)
		expect(readAllBodySchema.safeParse({ category: 2 }).success).toBe(true)
		expect(readAllBodySchema.safeParse({ category: 3 }).success).toBe(true)
	})

	it('拒绝 category=4', () => {
		expect(readAllBodySchema.safeParse({ category: 4 }).success).toBe(false)
	})

	it('拒绝 category=0', () => {
		expect(readAllBodySchema.safeParse({ category: 0 }).success).toBe(false)
	})
})
