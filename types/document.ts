/**
 * 文档相关前端类型定义（对应 server/api/documents/*）
 *
 * 时间字段统一为毫秒时间戳，前端用 utils/format.ts 的 formatTime 显示
 */

/** 文档状态：1草稿 / 2编辑中 / 3审批中 / 4已发布 / 5已驳回 / 6已删除 */
export type DocumentStatus = 1 | 2 | 3 | 4 | 5 | 6

/** 仓库文件列表行（GET /api/documents） */
export interface DocumentListItem {
	id:             number
	title:          string
	ext:            string
	status:         DocumentStatus
	versionNo:      string | null
	fileSize:       number | null
	ownerId:        number
	ownerName:      string
	updatedAt:      number
	downloadCount:  number
	isPinned:       boolean
	isFavorited:    boolean
}

/** 文件详情（GET /api/documents/:id） */
export interface DocumentDetail {
	id:        number
	title:     string
	ext:       string
	status:    DocumentStatus
	groupId:   number | null
	groupName: string | null
	ownerId:   number
	ownerName: string
	currentVersion: {
		id:              number
		versionNo:       string
		fileSize:        number
		mimeType:        string | null
		uploadedByName:  string
		publishedAt:     number | null
	} | null
	createdAt:          number
	updatedAt:          number
	downloadCount:      number
	isPinned:           boolean
	isFavorited:        boolean
	sourceDocId:        number | null
	canEdit:            boolean
	canRemove:          boolean
	canSubmitApproval:  boolean
	canUploadVersion:   boolean
}

/** 上传 / 更新版本 返回结构 */
export interface UploadResult {
	documentId:          number
	versionId:           number
	path:                'direct_publish' | 'approval'
	approvalInstanceId:  number | null
}

/** 仓库列表分页包装（比标准 PaginatedData 多一个 reviewingCount） */
export interface DocumentListResponse {
	list:            DocumentListItem[]
	total:           number
	page:            number
	pageSize:        number
	reviewingCount:  number
}

/** 预览响应 */
export interface PreviewResponse {
	html:       string
	versionNo:  string
	mimeType:   string
}
