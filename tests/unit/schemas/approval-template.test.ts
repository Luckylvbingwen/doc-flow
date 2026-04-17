import { describe, it, expect } from 'vitest'
import { saveApprovalTemplateSchema } from '~/server/schemas/approval-template'

describe('saveApprovalTemplateSchema', () => {
	it('接受合法开启配置（依次 + 3 审批人）', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [10001, 10002, 10003],
		})
		expect(result.success).toBe(true)
	})

	it('接受合法关闭配置（审批人可空）', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 0,
			mode: 1,
			approverUserIds: [],
		})
		expect(result.success).toBe(true)
	})

	it('接受会签模式', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 2,
			approverUserIds: [10001],
		})
		expect(result.success).toBe(true)
	})

	it('接受单人审批', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [10001],
		})
		expect(result.success).toBe(true)
	})

	it('拒绝开启审批但审批人为空', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [],
		})
		expect(result.success).toBe(false)
		if (!result.success) {
			const hasExpectedIssue = result.error.issues.some(
				(i) => i.path.join('.') === 'approverUserIds' && i.message === '开启审批时审批人不能为空',
			)
			expect(hasExpectedIssue).toBe(true)
		}
	})

	it('拒绝非法 mode=3', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 3,
			approverUserIds: [10001],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝审批人超过 20 人', () => {
		const ids = Array.from({ length: 21 }, (_, i) => i + 1)
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: ids,
		})
		expect(result.success).toBe(false)
	})

	it('拒绝审批人 userId 重复', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [10001, 10002, 10001],
		})
		expect(result.success).toBe(false)
		if (!result.success) {
			const hasExpectedIssue = result.error.issues.some(
				(i) => i.path.join('.') === 'approverUserIds' && i.message === '审批人不能重复',
			)
			expect(hasExpectedIssue).toBe(true)
		}
	})

	it('拒绝审批人 userId 为负数', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [-1],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝审批人 userId 为小数', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
			approverUserIds: [1.5],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝 approvalEnabled=2（非 0/1）', () => {
		const result = saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 2,
			mode: 1,
			approverUserIds: [10001],
		})
		expect(result.success).toBe(false)
	})

	it('拒绝缺字段', () => {
		expect(saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			mode: 1,
		}).success).toBe(false)

		expect(saveApprovalTemplateSchema.safeParse({
			approvalEnabled: 1,
			approverUserIds: [],
		}).success).toBe(false)
	})
})
