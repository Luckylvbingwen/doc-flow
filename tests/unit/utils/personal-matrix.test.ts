import { describe, it, expect } from 'vitest'
import { getActions, primaryActions, menuActions } from '~/utils/personal-matrix'
import type { PersonalDocItem } from '~/types/personal'

function makeDoc(overrides: Partial<PersonalDocItem>): PersonalDocItem {
	return {
		id: 1,
		title: 't',
		ext: 'md',
		status: 1,
		groupId: null,
		groupName: '-',
		ownerUserId: 10001,
		ownerName: 'admin',
		versionNo: 'v1.0',
		fileSize: 0,
		updatedAt: Date.now(),
		source: 'mine',
		permissionLevel: null,
		...overrides,
	}
}

const SELF = 10001
const OTHER = 10002

describe('personal-matrix getActions', () => {
	it('所有项都有"查看"主按钮', () => {
		const doc = makeDoc({ status: 4, source: 'mine' })
		const acts = getActions(doc, SELF)
		expect(acts.find(a => a.kind === 'view')).toBeTruthy()
	})

	describe('撤回按钮', () => {
		it('审批中 + 我创建的 → 有撤回', () => {
			const doc = makeDoc({ status: 3, source: 'mine', ownerUserId: SELF })
			const acts = getActions(doc, SELF)
			expect(acts.find(a => a.kind === 'withdraw')).toBeTruthy()
		})

		it('审批中 但非 owner → 无撤回', () => {
			const doc = makeDoc({ status: 3, source: 'shared', ownerUserId: OTHER })
			expect(getActions(doc, SELF).find(a => a.kind === 'withdraw')).toBeUndefined()
		})

		it('非审批中 → 无撤回', () => {
			const doc = makeDoc({ status: 4, source: 'mine', ownerUserId: SELF })
			expect(getActions(doc, SELF).find(a => a.kind === 'withdraw')).toBeUndefined()
		})
	})

	describe('删除按钮', () => {
		it('草稿 + 我创建的 + mine source → 有删除', () => {
			const doc = makeDoc({ status: 1, source: 'mine', ownerUserId: SELF })
			expect(getActions(doc, SELF).find(a => a.kind === 'delete')).toBeTruthy()
		})

		it('草稿 但非 owner → 无删除', () => {
			const doc = makeDoc({ status: 1, source: 'shared', ownerUserId: OTHER })
			expect(getActions(doc, SELF).find(a => a.kind === 'delete')).toBeUndefined()
		})

		it('编辑中 → 无删除（仅草稿可删）', () => {
			const doc = makeDoc({ status: 2, source: 'mine', ownerUserId: SELF })
			expect(getActions(doc, SELF).find(a => a.kind === 'delete')).toBeUndefined()
		})

		it('已发布 + 我创建的 → 无删除', () => {
			const doc = makeDoc({ status: 4, source: 'mine', ownerUserId: SELF })
			expect(getActions(doc, SELF).find(a => a.kind === 'delete')).toBeUndefined()
		})
	})

	describe('primaryActions / menuActions 分组', () => {
		it('查看在主按钮区；撤回/删除在菜单', () => {
			const doc = makeDoc({ status: 3, source: 'mine', ownerUserId: SELF })
			expect(primaryActions(doc, SELF).map(a => a.kind)).toEqual(['view'])
			expect(menuActions(doc, SELF).map(a => a.kind)).toContain('withdraw')
		})
	})

	describe('延迟项不渲染', () => {
		it('编辑/分享/下载/提交发布/转移归属人/申请编辑权限 均不出现', () => {
			const scenarios: Array<Partial<PersonalDocItem>> = [
				{ status: 1, source: 'mine', ownerUserId: SELF },      // 草稿 + 我
				{ status: 2, source: 'mine', ownerUserId: SELF },      // 编辑中 + 我
				{ status: 4, source: 'mine', ownerUserId: SELF },      // 已发布 + 我
				{ status: 4, source: 'shared', ownerUserId: OTHER, permissionLevel: 1 }, // 已发布 + 分享可编辑
				{ status: 4, source: 'shared', ownerUserId: OTHER, permissionLevel: 2 }, // 已发布 + 分享可阅读
				{ status: 4, source: 'favorite', ownerUserId: OTHER },                   // 已发布 + 共享文档收藏
			]
			for (const s of scenarios) {
				const doc = makeDoc(s)
				const kinds = getActions(doc, SELF).map(a => a.kind)
				for (const blocked of ['edit', 'share', 'download', 'submit', 'transfer', 'request-edit']) {
					expect(kinds).not.toContain(blocked as never)
				}
			}
		})
	})
})
