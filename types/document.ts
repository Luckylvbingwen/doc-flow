/**
 * 文档相关前端类型定义（对应 server/api/documents/*）
 *
 * 时间字段统一为毫秒时间戳，前端用 utils/format.ts 的 formatTime 显示
 */

/** 文档状态：1草稿 / 2编辑中 / 3审批中 / 4已发布 / 5已驳回 / 6已删除 */
export type DocumentStatus = 1 | 2 | 3 | 4 | 5 | 6

/** 组文件列表行（GET /api/documents） */
export interface DocumentListItem {
	id: number
	title: string
	ext: string
	status: DocumentStatus
	versionNo: string | null
	fileSize: number | null
	ownerId: number
	ownerName: string
	updatedAt: number
	downloadCount: number
	isPinned: boolean
	isFavorited: boolean
	/** 该文档是否已设置文档级权限（PRD §6.3.3 行级橙锁图标 / §6.3.4 弹窗保存后） */
	hasCustomPermissions: boolean
}

/** 文件详情（GET /api/documents/:id） */
export interface DocumentDetail {
	id: number
	title: string
	ext: string
	status: DocumentStatus
	groupId: number | null
	groupName: string | null
	ownerId: number
	ownerName: string
	currentVersion: {
		id: number
		versionNo: string
		fileSize: number
		mimeType: string | null
		uploadedByName: string
		publishedAt: number | null
	} | null
	createdAt: number
	updatedAt: number
	downloadCount: number
	isPinned: boolean
	isFavorited: boolean
	/** 该文档是否已设置文档级权限（PRD §6.3.4 文件信息卡橙锁图标） */
	hasCustomPermissions: boolean
	sourceDocId: number | null
	canEdit: boolean
	canRemove: boolean
	canSubmitApproval: boolean
	canUploadVersion: boolean
	canPin: boolean
	/** 当前用户是否可配置该文档的文档级权限（PRD §6.3.4 仅组管理员可配置） */
	canManagePermissions: boolean
}

/** 上传 / 更新版本 返回结构 */
export interface UploadResult {
	documentId: number
	versionId: number
	path: 'direct_publish' | 'approval'
	approvalInstanceId: number | null
}

/** 共享文档组面板 — 列表分页包装（含组级权限标志） */
export interface DocumentListResponse {
	list: DocumentListItem[]
	total: number
	page: number
	pageSize: number
	reviewingCount: number
	/** 当前用户在此组是否有置顶权限（组管理员及上游） */
	canPin: boolean
	/** 当前用户在此组是否可配置文档级权限（与 canPin 同口径） */
	canManagePermissions: boolean
	/** 当前用户是否可创建子组（与 canPin 同口径） */
	canCreateSubgroup: boolean
	/** 当前用户是否可上传新文件到此组（组内活跃成员 OR 上游管理员） */
	canUpload: boolean
}

/** 预览响应 */
export interface PreviewResponse {
	html: string
	versionNo: string
	mimeType: string
}
