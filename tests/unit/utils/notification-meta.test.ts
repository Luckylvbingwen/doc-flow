import { describe, it, expect } from 'vitest'
import { resolveRoute, NOTIFICATION_META, getNotificationMeta, DEFAULT_META } from '~/utils/notification-meta'

describe('resolveRoute', () => {
	it('document 类型 → /docs/file/:id', () => {
		expect(resolveRoute('document', '12345')).toEqual({ path: '/docs/file/12345' })
	})

	it('group 类型 → /docs/repo/:id', () => {
		expect(resolveRoute('group', '67890')).toEqual({ path: '/docs/repo/67890' })
	})

	it('group_approval 类型 → /docs/repo/:id?openSettings=approval', () => {
		expect(resolveRoute('group_approval', '42')).toEqual({
			path: '/docs/repo/42',
			query: { openSettings: 'approval' },
		})
	})

	it('bizType 为 null → null（不跳转）', () => {
		expect(resolveRoute(null, '1')).toBeNull()
	})

	it('bizId 为 null → null（不跳转）', () => {
		expect(resolveRoute('document', null)).toBeNull()
	})

	it('未知 bizType → null', () => {
		expect(resolveRoute('unknown' as never, '1')).toBeNull()
	})
})

describe('NOTIFICATION_META', () => {
	it('覆盖 M1-M24 全部 24 个 msg_code', () => {
		for (let i = 1; i <= 24; i++) {
			expect(NOTIFICATION_META[`M${i}`], `M${i} missing`).toBeDefined()
		}
	})

	it('每项含 icon 和 color 字段', () => {
		for (const code of Object.keys(NOTIFICATION_META)) {
			const meta = NOTIFICATION_META[code]
			expect(meta.icon).toBeDefined()
			expect(['primary', 'success', 'warning', 'danger', 'info']).toContain(meta.color)
		}
	})
})

describe('getNotificationMeta', () => {
	it('已知 msgCode 返回对应 meta', () => {
		expect(getNotificationMeta('M1')).toBe(NOTIFICATION_META.M1)
	})

	it('null msgCode 返回 DEFAULT_META', () => {
		expect(getNotificationMeta(null)).toBe(DEFAULT_META)
	})

	it('未知 msgCode 返回 DEFAULT_META', () => {
		expect(getNotificationMeta('M99')).toBe(DEFAULT_META)
	})
})
