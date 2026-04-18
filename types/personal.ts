/**
 * 个人中心前端类型（PRD §6.5）
 */

/** Tab：全部 / 我创建的 / 分享给我的 / 个人收藏 / 离职移交 */
export type PersonalTab = 'all' | 'mine' | 'shared' | 'favorite' | 'handover'

/** 文档状态（与后端 doc_documents.status 对齐） */
export type DocStatus = 1 | 2 | 3 | 4 | 5 | 6  // 1草稿 2编辑中 3审批中 4已发布 5已驳回 6已删除

/** 来源（PRD §6.5.2 "全部"TAB 来源徽章） */
export type ItemSource = 'mine' | 'shared' | 'favorite'

/** 文档级权限（1=可编辑 / 2=可阅读） */
export type PermissionLevel = 1 | 2

/** 个人中心列表项 */
export interface PersonalDocItem {
	id: number
	title: string
	ext: string
	status: DocStatus
	groupId: number | null
	groupName: string
	ownerUserId: number
	ownerName: string
	versionNo: string
	fileSize: number
	updatedAt: number
	source: ItemSource
	/** shared 来源时为 1/2；否则 null */
	permissionLevel: PermissionLevel | null
}

/** 离职移交分组（handover tab 返回） */
export interface HandoverGroup {
	userId: number
	userName: string
	avatarUrl: string
	departmentId: number
	departmentName: string
	leftAt: number
	documents: PersonalDocItem[]
}

export interface PersonalListQuery {
	tab: PersonalTab
	status?: 1 | 2 | 3 | 4
	keyword?: string
	page?: number
	pageSize?: number
}
