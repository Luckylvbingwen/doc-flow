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
	/** 是否为引用文档（PRD §6.10） */
	isReference?: boolean
	/** 引用记录 ID（取消引用时使用） */
	referenceId?: number
	/** 引用来源组名（PRD §6.10.2 悬停提示“引用自”） */
	sourceGroupName?: string
}

/** 文件详情（GET /api/documents/:id） */
export interface DocumentDetail {
	id: number
	title: string
	ext: string
	docType: number
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
	/** 当前用户是否可进行版本回滚（PRD §4.3 组管理员及上游） */
	canRollback: boolean
	/** 当前用户是否可发起归属人转移（仅归属人 + 已发布 + 无待处理转移，PRD §6.3.10） */
	canTransfer?: boolean
	/** 当前文档是否有待处理的归属人转移请求 */
	hasPendingTransfer?: boolean
	/** 当前用户是否可申请编辑权限（有可阅读权限 + 已发布 + 非归属人 + 无待处理申请，PRD §6.3.8） */
	canRequestEditPermission?: boolean
	/** 当前用户对该文档的文档级权限（2可编辑 / 3上传下载 / 4可阅读 / null无） */
	myDocPermission?: number | null
}

/** 文档权限申请项（归属人审批弹窗） */
export interface DocumentPermissionRequestItem {
	id: string
	userId: number
	userName: string
	avatarUrl: string | null
	type: 1 | 2
	reason: string | null
	createdAt: number
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
	/** 当前页或当前查询结果中的引用文档数量（PRD §6.10.10 翻页器可标注“含 N 条引用”） */
	referenceCount?: number
	/** 当前用户在此组是否有置顶权限（组管理员及上游） */
	canPin: boolean
	/** 当前用户在此组是否可配置文档级权限（与 canPin 同口径） */
	canManagePermissions: boolean
	/** 当前用户是否可创建子组（与 canPin 同口径） */
	canCreateSubgroup: boolean
	/** 当前用户是否可上传新文件到此组（组内活跃成员 OR 上游管理员） */
	canUpload: boolean
	/** 当前用户是否可在线编辑他人文档（组内 role=1/2 OR 上游管理员） */
	canEditInGroup: boolean
}

/** 预览响应 */
export interface PreviewResponse {
	html: string
	versionNo: string
	mimeType: string
}
