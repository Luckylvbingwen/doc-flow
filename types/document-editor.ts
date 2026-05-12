export interface DraftContent {
	title: string
	content: string
	status: number  // 1=草稿 2=编辑中
	docType: number // 1=文件 2=在线Markdown
}

export interface EditCopyResult {
	id: string
	isNew: boolean
}

export interface AnnotationItem {
	id: string
	content: string
	quoteText: string
	anchorData: Record<string, unknown>
	authorName: string
	createdAt: number
	status: number  // 1=打开 2=已解决
	resolvedAt: number | null
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'
