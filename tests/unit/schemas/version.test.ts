import { describe, it, expect } from 'vitest'
import { versionCompareSchema, versionListQuerySchema } from '~/server/schemas/version'

describe('versionListQuerySchema', () => {
	it('应接受默认值', () => {
		const result = versionListQuerySchema.parse({})
		expect(result).toEqual({ page: 1, pageSize: 20 })
	})

	it('应接受合法分页参数', () => {
		const result = versionListQuerySchema.parse({ page: '3', pageSize: '10' })
		expect(result).toEqual({ page: 3, pageSize: 10 })
	})

	it('应拒绝 page < 1', () => {
		expect(() => versionListQuerySchema.parse({ page: 0 })).toThrow()
	})

	it('应拒绝 pageSize > 100', () => {
		expect(() => versionListQuerySchema.parse({ pageSize: 200 })).toThrow()
	})
})

describe('versionCompareSchema', () => {
	it('应接受合法参数', () => {
		const result = versionCompareSchema.parse({
			documentId: 1,
			fromVersionId: 100,
			toVersionId: 99,
		})
		expect(result).toEqual({
			documentId: 1,
			fromVersionId: 100,
			toVersionId: 99,
		})
	})

	it('应拒绝缺少 documentId', () => {
		expect(() =>
			versionCompareSchema.parse({ fromVersionId: 1, toVersionId: 2 })
		).toThrow()
	})

	it('应拒绝 fromVersionId <= 0', () => {
		expect(() =>
			versionCompareSchema.parse({
				documentId: 1,
				fromVersionId: 0,
				toVersionId: 2,
			})
		).toThrow()
	})

	it('应拒绝 toVersionId 为负数', () => {
		expect(() =>
			versionCompareSchema.parse({
				documentId: 1,
				fromVersionId: 1,
				toVersionId: -1,
			})
		).toThrow()
	})

	it('应拒绝非整数', () => {
		expect(() =>
			versionCompareSchema.parse({
				documentId: 1.5,
				fromVersionId: 1,
				toVersionId: 2,
			})
		).toThrow()
	})
})
