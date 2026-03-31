/**
 * 版本管理与对比相关类型
 */

/** 版本信息（列表项） */
export interface VersionInfo {
	id: number
	documentId: number
	versionNo: string
	fileSize: number
	mimeType: string | null
	changeNote: string | null
	uploadedBy: number
	uploaderName: string
	publishedAt: number | null
	createdAt: number
	isCurrent: boolean
	/** 回滚来源版本号（如 "v1.0"），非回滚版本为 null */
	rollbackFrom: string | null
}

/** 对比模式 */
export type CompareMode = 'side-by-side' | 'top-bottom' | 'overlay'

/** diff 块类型 */
export type DiffType = 'equal' | 'add' | 'del' | 'modify'

/** 单个 diff 块 */
export interface DiffChunk {
	type: DiffType
	/** 旧版内容（equal/del/modify 时有值） */
	oldValue?: string
	/** 新版内容（equal/add/modify 时有值） */
	newValue?: string
}

/** 变更摘要 */
export interface DiffSummary {
	addCount: number
	delCount: number
	modCount: number
	/** 如 "+2.3 KB" 或 "-1.1 KB" */
	sizeChange: string
	/** 按章节/页面的变更明细 */
	items: DiffSummaryItem[]
}

/** 变更明细条目 */
export interface DiffSummaryItem {
	type: 'add' | 'del' | 'modify'
	text: string
}

/** 版本对比结果 */
export interface CompareResult {
	documentId: number
	fileName: string
	fileType: string
	newVersion: ComparePaneData
	oldVersion: ComparePaneData
	summary: DiffSummary
	/** 结构化 diff 块（文本类文件） */
	chunks: DiffChunk[]
}

/** 对比面板数据 */
export interface ComparePaneData {
	versionId: number
	versionNo: string
	/** 带 diff 高亮标记的 HTML */
	html: string
}
