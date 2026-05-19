/**
 * 个人中心操作矩阵（PRD §6.5.2 操作矩阵）
 *
 * 严格按 PRD 操作矩阵表逐行实现：
 *   状态×来源 → 直接按钮(inMenu=false) + ···更多菜单(inMenu=true)
 */
import type { PersonalDocItem, ItemSource } from '~/types/personal'

export type ActionKind = 'view' | 'download' | 'share' | 'publish' | 'withdraw' | 'delete' | 'transfer' | 'requestEdit' | 'edit' | 'unfavorite'

export interface ActionSpec {
	kind: ActionKind
	label: string
	/** UI type: primary / danger / default */
	type: 'primary' | 'danger' | 'default'
	/** 是否放在"更多"菜单而非主按钮区 */
	inMenu: boolean
}

/**
 * 按 PRD §6.5.2 操作矩阵计算一个列表项可见的按钮集
 *
 * @param doc  列表项
 * @param currentUserId  当前登录用户 id，用于 owner 判定
 */
export function getActions(doc: PersonalDocItem, currentUserId: number): ActionSpec[] {
	const actions: ActionSpec[] = []
	const isOwner = doc.ownerUserId === currentUserId
	const source: ItemSource = doc.source
	const isSharedEditable = source === 'shared' && (doc.permissionLevel === 1 || doc.permissionLevel === 2)

	// ── PRD 矩阵逐行实现 ──

	if (doc.status === 1 && source === 'mine') {
		// 草稿 + 我创建的 → 编辑 | 分享/下载/提交发布/删除(红)
		actions.push({ kind: 'edit', label: '编辑', type: 'primary', inMenu: false })
		actions.push({ kind: 'share', label: '分享', type: 'default', inMenu: true })
		actions.push({ kind: 'download', label: '下载', type: 'default', inMenu: true })
		actions.push({ kind: 'publish', label: '提交发布', type: 'default', inMenu: true })
		actions.push({ kind: 'delete', label: '删除', type: 'danger', inMenu: true })
	} else if (doc.status === 2 && (source === 'mine' || isSharedEditable)) {
		// 编辑中 + 我创建的 / 分享给我的（可编辑） → 编辑 | 分享/下载/提交发布
		actions.push({ kind: 'edit', label: '编辑', type: 'primary', inMenu: false })
		actions.push({ kind: 'share', label: '分享', type: 'default', inMenu: true })
		actions.push({ kind: 'download', label: '下载', type: 'default', inMenu: true })
		actions.push({ kind: 'publish', label: '提交发布', type: 'default', inMenu: true })
	} else if (doc.status === 3 && source === 'mine') {
		// 审批中 + 我创建的 → 查看 | 分享/下载/撤回(红)
		actions.push({ kind: 'view', label: '查看', type: 'primary', inMenu: false })
		actions.push({ kind: 'share', label: '分享', type: 'default', inMenu: true })
		actions.push({ kind: 'download', label: '下载', type: 'default', inMenu: true })
		actions.push({ kind: 'withdraw', label: '撤回', type: 'danger', inMenu: true })
	} else if (doc.status === 3) {
		// 审批中 + 分享给我的 → 查看 | 分享/下载
		actions.push({ kind: 'view', label: '查看', type: 'primary', inMenu: false })
		actions.push({ kind: 'share', label: '分享', type: 'default', inMenu: true })
		actions.push({ kind: 'download', label: '下载', type: 'default', inMenu: true })
	} else if (doc.status === 4 && source === 'mine') {
		// 已发布 + 我创建的 → 查看+编辑 | 分享/下载/转移归属人
		actions.push({ kind: 'view', label: '查看', type: 'primary', inMenu: false })
		actions.push({ kind: 'edit', label: '编辑', type: 'primary', inMenu: false })
		actions.push({ kind: 'share', label: '分享', type: 'default', inMenu: true })
		actions.push({ kind: 'download', label: '下载', type: 'default', inMenu: true })
		actions.push({ kind: 'transfer', label: '转移归属人', type: 'default', inMenu: true })
	} else if (doc.status === 4 && isSharedEditable) {
		// 已发布 + 分享给我的（可编辑） → 查看+编辑 | 分享/下载
		actions.push({ kind: 'view', label: '查看', type: 'primary', inMenu: false })
		actions.push({ kind: 'edit', label: '编辑', type: 'primary', inMenu: false })
		actions.push({ kind: 'share', label: '分享', type: 'default', inMenu: true })
		actions.push({ kind: 'download', label: '下载', type: 'default', inMenu: true })
	} else if (doc.status === 4 && source === 'shared') {
		// 已发布 + 分享给我的（可阅读） → 查看+申请编辑权限 | 分享/下载
		actions.push({ kind: 'view', label: '查看', type: 'primary', inMenu: false })
		actions.push({ kind: 'requestEdit', label: '申请编辑权限', type: 'default', inMenu: false })
		actions.push({ kind: 'share', label: '分享', type: 'default', inMenu: true })
		actions.push({ kind: 'download', label: '下载', type: 'default', inMenu: true })
	} else if (doc.status === 4 && source === 'favorite') {
		// 已发布 + 共享文档（收藏） → 查看 | 分享/下载/取消收藏
		actions.push({ kind: 'view', label: '查看', type: 'primary', inMenu: false })
		actions.push({ kind: 'share', label: '分享', type: 'default', inMenu: true })
		actions.push({ kind: 'download', label: '下载', type: 'default', inMenu: true })
		actions.push({ kind: 'unfavorite', label: '取消收藏', type: 'default', inMenu: true })
	} else if (doc.status === 5 && isOwner) {
		// 已驳回 + 我创建的 → 编辑 | 提交发布
		actions.push({ kind: 'edit', label: '编辑', type: 'primary', inMenu: false })
		actions.push({ kind: 'publish', label: '提交发布', type: 'default', inMenu: true })
	} else {
		// 兜底：至少有"查看"
		actions.push({ kind: 'view', label: '查看', type: 'primary', inMenu: false })
	}

	return actions
}

/** 直接按钮（inMenu=false） */
export function primaryActions(doc: PersonalDocItem, currentUserId: number): ActionSpec[] {
	return getActions(doc, currentUserId).filter(a => !a.inMenu)
}

/** 更多菜单按钮（inMenu=true） */
export function menuActions(doc: PersonalDocItem, currentUserId: number): ActionSpec[] {
	return getActions(doc, currentUserId).filter(a => a.inMenu)
}
