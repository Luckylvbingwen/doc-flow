import { describe, it, expect } from 'vitest'
import { feishuNotifySchema, feishuUsersQuerySchema } from '~/server/schemas/integration'

describe('feishuNotifySchema', () => {
	it('接受文本消息', () => {
		const result = feishuNotifySchema.safeParse({
			openId: 'ou_abc123',
			msgType: 'text',
			text: '你好',
		})
		expect(result.success).toBe(true)
	})

	it('接受卡片消息', () => {
		const result = feishuNotifySchema.safeParse({
			openId: 'ou_abc123',
			msgType: 'card',
			card: { header: { title: { tag: 'plain_text', content: '标题' } } },
		})
		expect(result.success).toBe(true)
	})

	it('拒绝空 openId', () => {
		const result = feishuNotifySchema.safeParse({
			openId: '',
			msgType: 'text',
			text: '你好',
		})
		expect(result.success).toBe(false)
	})

	it('文本消息缺少 text 时拒绝', () => {
		const result = feishuNotifySchema.safeParse({
			openId: 'ou_abc123',
			msgType: 'text',
		})
		expect(result.success).toBe(false)
	})

	it('卡片消息缺少 card 时拒绝', () => {
		const result = feishuNotifySchema.safeParse({
			openId: 'ou_abc123',
			msgType: 'card',
		})
		expect(result.success).toBe(false)
	})

	it('默认 msgType 为 text', () => {
		const result = feishuNotifySchema.safeParse({
			openId: 'ou_abc123',
			text: '你好',
		})
		expect(result.success).toBe(true)
	})
})

describe('feishuUsersQuerySchema', () => {
	it('提供默认值', () => {
		const result = feishuUsersQuerySchema.safeParse({})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.status).toBe('normal')
			expect(result.data.keyword).toBe('')
		}
	})

	it('接受自定义 status', () => {
		const result = feishuUsersQuerySchema.safeParse({ status: 'hidden' })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.status).toBe('hidden')
		}
	})
})
