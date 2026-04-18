import { describe, it, expect } from 'vitest'
import {
	APPROVAL_STATUS_META,
	APPROVAL_CHANGE_TYPE_META,
	getStatusMeta,
	getChangeTypeMeta,
} from '~/utils/approval-meta'
import type { ApprovalStatus, ApprovalChangeType } from '~/types/approval'

describe('approval-meta', () => {
	describe('APPROVAL_STATUS_META', () => {
		it('覆盖 5 个状态', () => {
			expect(Object.keys(APPROVAL_STATUS_META).sort()).toEqual(['1', '2', '3', '4', '5'])
		})

		it('每个状态都有 label / color / bg', () => {
			for (const s of [1, 2, 3, 4, 5] as ApprovalStatus[]) {
				const m = APPROVAL_STATUS_META[s]
				expect(m.label).toBeTruthy()
				expect(m.color).toMatch(/^#/)
				expect(m.bg).toMatch(/^#/)
			}
		})

		it('状态名与 PRD §6.4 对齐', () => {
			expect(APPROVAL_STATUS_META[1].label).toBe('待审批')
			expect(APPROVAL_STATUS_META[2].label).toBe('审批中')
			expect(APPROVAL_STATUS_META[3].label).toBe('已通过')
			expect(APPROVAL_STATUS_META[4].label).toBe('已驳回')
			expect(APPROVAL_STATUS_META[5].label).toBe('已撤回')
		})
	})

	describe('APPROVAL_CHANGE_TYPE_META', () => {
		it('new=新增 绿 / iterate=迭代 蓝', () => {
			expect(APPROVAL_CHANGE_TYPE_META.new.label).toBe('新增')
			expect(APPROVAL_CHANGE_TYPE_META.iterate.label).toBe('迭代')
		})
	})

	describe('getStatusMeta', () => {
		it('返回已知状态的 meta', () => {
			const m = getStatusMeta(2)
			expect(m.label).toBe('审批中')
		})

		it('未知状态返回兜底', () => {
			const m = getStatusMeta(99 as ApprovalStatus)
			expect(m.label).toBe('未知')
		})
	})

	describe('getChangeTypeMeta', () => {
		it('返回已知类型', () => {
			expect(getChangeTypeMeta('new').label).toBe('新增')
			expect(getChangeTypeMeta('iterate').label).toBe('迭代')
		})

		it('未知类型返回空 label', () => {
			const m = getChangeTypeMeta('xxx' as ApprovalChangeType)
			expect(m.label).toBe('')
		})
	})
})
