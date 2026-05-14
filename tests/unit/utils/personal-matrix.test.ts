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
		docType: 1,
		...overrides,
	}
}

const SELF = 10001
const OTHER = 10002

describe('personal-matrix getActions', () => {
	describe('草稿 + 我创建的', () => {
		it('直接按钮=编辑, 更多=分享/下载/提交发布/删除', () => {
			const doc = makeDoc({ status: 1, source: 'mine', ownerUserId: SELF })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['edit'])
			expect(menu).toEqual(['share', 'download', 'publish', 'delete'])
		})
	})

	describe('编辑中 + 我创建的', () => {
		it('直接按钮=编辑, 更多=分享/下载/提交发布', () => {
			const doc = makeDoc({ status: 2, source: 'mine', ownerUserId: SELF })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['edit'])
			expect(menu).toEqual(['share', 'download', 'publish'])
		})
	})

	describe('编辑中 + 分享给我的（可编辑）', () => {
		it('直接按钮=编辑, 更多=分享/下载（非 owner 无提交发布）', () => {
			const doc = makeDoc({ status: 2, source: 'shared', ownerUserId: OTHER, permissionLevel: 2 })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['edit'])
			expect(menu).toEqual(['share', 'download'])
		})
	})

	describe('审批中 + 我创建的', () => {
		it('直接按钮=查看, 更多=分享/下载/撤回', () => {
			const doc = makeDoc({ status: 3, source: 'mine', ownerUserId: SELF })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['view'])
			expect(menu).toEqual(['share', 'download', 'withdraw'])
		})
	})

	describe('审批中 + 分享给我的', () => {
		it('直接按钮=查看, 更多=分享/下载', () => {
			const doc = makeDoc({ status: 3, source: 'shared', ownerUserId: OTHER })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['view'])
			expect(menu).toEqual(['share', 'download'])
		})
	})

	describe('已发布 + 我创建的', () => {
		it('直接按钮=查看+编辑, 更多=分享/下载/转移归属人', () => {
			const doc = makeDoc({ status: 4, source: 'mine', ownerUserId: SELF })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['view', 'edit'])
			expect(menu).toEqual(['share', 'download', 'transfer'])
		})
	})

	describe('已发布 + 分享给我的（可编辑）', () => {
		it('直接按钮=查看+编辑, 更多=分享/下载', () => {
			const doc = makeDoc({ status: 4, source: 'shared', ownerUserId: OTHER, permissionLevel: 2 })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['view', 'edit'])
			expect(menu).toEqual(['share', 'download'])
		})
	})

	describe('已发布 + 分享给我的（可阅读）', () => {
		it('直接按钮=查看+申请编辑权限, 更多=分享/下载', () => {
			const doc = makeDoc({ status: 4, source: 'shared', ownerUserId: OTHER, permissionLevel: 4 })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['view', 'requestEdit'])
			expect(menu).toEqual(['share', 'download'])
		})
	})

	describe('已发布 + 共享文档（收藏）', () => {
		it('直接按钮=查看, 更多=分享/下载/取消收藏', () => {
			const doc = makeDoc({ status: 4, source: 'favorite', ownerUserId: OTHER })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['view'])
			expect(menu).toEqual(['share', 'download', 'unfavorite'])
		})
	})

	describe('已驳回 + 我创建的', () => {
		it('直接按钮=编辑, 更多=提交发布', () => {
			const doc = makeDoc({ status: 5, source: 'mine', ownerUserId: SELF })
			const primary = primaryActions(doc, SELF).map(a => a.kind)
			const menu = menuActions(doc, SELF).map(a => a.kind)
			expect(primary).toEqual(['edit'])
			expect(menu).toEqual(['publish'])
		})
	})

	describe('撤回按钮', () => {
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

	describe('兜底', () => {
		it('未匹配任何规则时至少有查看', () => {
			const doc = makeDoc({ status: 1, source: 'shared', ownerUserId: OTHER })
			const acts = getActions(doc, SELF)
			expect(acts.length).toBeGreaterThanOrEqual(1)
			expect(acts[0].kind).toBe('view')
		})
	})
})
