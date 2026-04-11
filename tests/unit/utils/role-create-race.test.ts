import { describe, it, expect } from 'vitest'
import { isDuplicateKeyError } from '~/server/utils/db-errors'

describe('isDuplicateKeyError', () => {
	it('识别 Prisma P2002 唯一约束错误', () => {
		const error = Object.assign(new Error('Unique constraint failed'), {
			code: 'P2002',
			meta: { target: ['code'] },
		})
		expect(isDuplicateKeyError(error)).toBe(true)
	})

	it('识别 MySQL ER_DUP_ENTRY 错误', () => {
		const error = Object.assign(new Error("Duplicate entry 'admin' for key 'uk_code_deleted'"), {
			code: 'ER_DUP_ENTRY',
			errno: 1062,
		})
		expect(isDuplicateKeyError(error)).toBe(true)
	})

	it('识别仅有 errno 1062 的错误', () => {
		const error = Object.assign(new Error('duplicate'), { errno: 1062 })
		expect(isDuplicateKeyError(error)).toBe(true)
	})

	it('不误判其他错误', () => {
		expect(isDuplicateKeyError(new Error('random error'))).toBe(false)
	})

	it('不误判 null/undefined', () => {
		expect(isDuplicateKeyError(null)).toBe(false)
		expect(isDuplicateKeyError(undefined)).toBe(false)
	})

	it('不误判非对象类型', () => {
		expect(isDuplicateKeyError('string')).toBe(false)
		expect(isDuplicateKeyError(42)).toBe(false)
	})
})
