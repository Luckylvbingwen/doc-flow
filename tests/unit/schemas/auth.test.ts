import { describe, it, expect } from 'vitest'
import { loginBodySchema, feishuCallbackBodySchema, feishuAuthUrlQuerySchema } from '~/server/schemas/auth'

describe('loginBodySchema', () => {
	it('接受合法参数', () => {
		const result = loginBodySchema.safeParse({
			account: 'admin@docflow.local',
			password: 'Docflow@123',
			captchaClicks: [{ x: 100, y: 200 }],
			captchaToken: 'abc123',
		})
		expect(result.success).toBe(true)
	})

	it('拒绝空账号', () => {
		const result = loginBodySchema.safeParse({
			account: '',
			password: 'Docflow@123',
			captchaClicks: [],
			captchaToken: 'abc',
		})
		expect(result.success).toBe(false)
	})

	it('拒绝缺失密码', () => {
		const result = loginBodySchema.safeParse({
			account: 'admin@docflow.local',
			captchaClicks: [],
			captchaToken: 'abc',
		})
		expect(result.success).toBe(false)
	})

	it('拒绝非数组 captchaClicks', () => {
		const result = loginBodySchema.safeParse({
			account: 'admin@docflow.local',
			password: 'Docflow@123',
			captchaClicks: 'not-array',
			captchaToken: 'abc',
		})
		expect(result.success).toBe(false)
	})

	it('拒绝 captchaClicks 中缺少 y 坐标', () => {
		const result = loginBodySchema.safeParse({
			account: 'admin@docflow.local',
			password: 'Docflow@123',
			captchaClicks: [{ x: 100 }],
			captchaToken: 'abc',
		})
		expect(result.success).toBe(false)
	})
})

describe('feishuCallbackBodySchema', () => {
	it('接受合法参数', () => {
		const result = feishuCallbackBodySchema.safeParse({
			code: 'auth_code_123',
			state: 'state_abc',
		})
		expect(result.success).toBe(true)
	})

	it('拒绝空 code', () => {
		const result = feishuCallbackBodySchema.safeParse({
			code: '',
			state: 'state_abc',
		})
		expect(result.success).toBe(false)
	})

	it('拒绝缺失 state', () => {
		const result = feishuCallbackBodySchema.safeParse({
			code: 'auth_code_123',
		})
		expect(result.success).toBe(false)
	})
})

describe('feishuAuthUrlQuerySchema', () => {
	it('接受合法 redirectUri', () => {
		const result = feishuAuthUrlQuerySchema.safeParse({
			redirectUri: 'http://localhost:3000/login',
		})
		expect(result.success).toBe(true)
	})

	it('拒绝空 redirectUri', () => {
		const result = feishuAuthUrlQuerySchema.safeParse({
			redirectUri: '',
		})
		expect(result.success).toBe(false)
	})
})
