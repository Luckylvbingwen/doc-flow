export interface DraftContent {
	title: string
	content: string
	status: number  // 1=草稿 2=编辑中
	docType: number // 1=文件 2=在线Markdown
}

export interface EditCopyResult {
	id: string
	isNew: boolean
	ownerUserId?: number
	ownerName?: string
	/** 当前版本未解决批注数 */
	unresolvedAnnotationCount?: number
}

export interface AnnotationReply {
	id: string
	content: string
	authorName: string
	authorAvatar: string | null
	createdAt: number
}

export interface AnnotationItem {
	id: string
	content: string
	quoteText: string
	anchorData: Record<string, unknown>
	authorName: string
	authorAvatar: string | null
	createdAt: number
	status: number  // 1=打开 2=已解决
	resolvedAt: number | null
	frozen: boolean  // 旧版本批注已冻结，不可编辑
	replies: AnnotationReply[]
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'
