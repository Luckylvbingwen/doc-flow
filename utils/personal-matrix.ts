/**
 * 个人中心操作矩阵（PRD §6.5.2 操作矩阵）
 *
 * 已激活动作：查看 / 下载 / 分享 / 撤回 / 删除草稿 / 提交发布 / 转移归属人 / 申请编辑权限
 * 待后续模块：编辑
 */
import type { PersonalDocItem, ItemSource } from '~/types/personal'

export type ActionKind = 'view' | 'download' | 'share' | 'publish' | 'withdraw' | 'delete' | 'transfer' | 'requestEdit' | 'edit'

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

	// ── 编辑按钮（在线文档草稿） ──
	if ((doc.status === 1 || doc.status === 2) && doc.docType === 2 && isOwner) {
		actions.push({ kind: 'edit', label: '编辑', type: 'primary', inMenu: false })
	}

	// ── 查看按钮 ──
	// PRD：审批中 + 我创建的 → 查看；已发布 + 分享可阅读 → 查看
	// A 阶段简化：所有项都有"查看"按钮（跳文件详情占位页）
	actions.push({ kind: 'view', label: '查看', type: 'primary', inMenu: false })

	// ── 下载按钮 ──
	// PRD：已发布文档可下载
	if (doc.status === 4) {
		actions.push({ kind: 'download', label: '下载', type: 'default', inMenu: false })
	}

	// ── 分享按钮 ──
	// PRD：已发布文档可分享
	if (doc.status === 4) {
		actions.push({ kind: 'share', label: '分享', type: 'default', inMenu: false })
	}

	// ── 提交发布按钮 ──
	// PRD：草稿(1)/已驳回(5) + 我创建的 → 提交发布
	if ((doc.status === 1 || doc.status === 5) && isOwner) {
		actions.push({ kind: 'publish', label: '提交发布', type: 'default', inMenu: true })
	}

	// ── 撤回按钮（红色）──
	// PRD：审批中 + 我创建的
	if (doc.status === 3 && isOwner) {
		actions.push({ kind: 'withdraw', label: '撤回', type: 'danger', inMenu: true })
	}

	// ── 删除按钮（红色）──
	// PRD：草稿 + 我创建的
	if (doc.status === 1 && isOwner && source === 'mine') {
		actions.push({ kind: 'delete', label: '删除', type: 'danger', inMenu: true })
	}

	// ── 转移归属人（更多菜单）──
	// PRD：已发布 + 我创建的 → 转移归属人
	if (doc.status === 4 && isOwner && source === 'mine') {
		actions.push({ kind: 'transfer', label: '转移归属人', type: 'default', inMenu: true })
	}

	// ── 申请编辑权限（主按钮）──
	// PRD：已发布 + 分享给我的（可阅读=4） → 查看 + 申请编辑权限
	if (doc.status === 4 && source === 'shared' && doc.permissionLevel === 4) {
		actions.push({ kind: 'requestEdit', label: '申请编辑权限', type: 'default', inMenu: false })
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
