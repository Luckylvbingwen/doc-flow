import { describe, it, expect, beforeAll } from 'vitest'

import { generateCaptcha, verifyCaptcha } from '~/server/utils/captcha'

// captcha.ts 的 getSecret() 在 useRuntimeConfig 不可用时回退到 process.env.JWT_SECRET
beforeAll(() => {
	process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long!!'
})

describe('generateCaptcha', () => {
	it('返回完整的验证码结构', () => {
		const result = generateCaptcha()
		expect(result).toHaveProperty('svg')
		expect(result).toHaveProperty('token')
		expect(result).toHaveProperty('prompt')
		expect(result.width).toBe(320)
		expect(result.height).toBe(180)
		expect(result.svg).toContain('<svg')
		expect(result.prompt).toMatch(/请依次点击/)
	})

	it('token 不包含明文坐标', () => {
		const result = generateCaptcha()
		// The encrypted token should be a single base64url string, NOT contain plaintext "x,y|x,y" patterns
		// Old format was "timestamp.x1,y1|x2,y2.signature" - this should no longer be the case
		const dotCount = (result.token.match(/\./g) || []).length
		// Old format had exactly 2 dots. New encrypted format should NOT have that structure.
		// Actually the new token is a single base64url encoded string with no dots at all.
		expect(dotCount).toBe(0)
	})
})

describe('verifyCaptcha', () => {
	it('用错误坐标应返回失败但不崩溃', () => {
		const captcha = generateCaptcha()
		const result = verifyCaptcha(
			[{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
			captcha.token
		)
		expect(result.valid).toBe(false)
		expect(result.message).toBeTruthy()
	})

	it('拒绝空 token', () => {
		const result = verifyCaptcha([{ x: 1, y: 1 }], '')
		expect(result.valid).toBe(false)
	})

	it('拒绝格式错误的 token', () => {
		const result = verifyCaptcha([{ x: 1, y: 1 }], 'bad-token-value')
		expect(result.valid).toBe(false)
	})

	it('拒绝被篡改的 token', () => {
		const captcha = generateCaptcha()
		const tampered = captcha.token.slice(0, -4) + 'xxxx'
		const result = verifyCaptcha(
			[{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
			tampered
		)
		expect(result.valid).toBe(false)
	})

	it('拒绝点击数量不匹配', () => {
		const captcha = generateCaptcha()
		const result = verifyCaptcha([{ x: 1, y: 1 }], captcha.token)
		expect(result.valid).toBe(false)
		expect(result.message).toBe('验证码点击次数不正确')
	})
})
