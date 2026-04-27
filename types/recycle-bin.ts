/**
 * 回收站前端类型
 */

/** 回收站单项 */
export interface RecycleItem {
	/** 文档 ID */
	id: number
	/** 文件名 */
	title: string
	/** 扩展名（pdf / docx / md / xlsx ...） */
	ext: string
	/** 原组 ID；草稿无组则为 null */
	groupId: number | null
	/** 原组名；无则显示 '-' */
	groupName: string
	/** 归属人 ID */
	ownerUserId: number
	/** 删除人 ID */
	deletedByUserId: number | null
	/** 删除人姓名 */
	deletedByName: string
	/** 删除时间（毫秒时间戳） */
	deletedAt: number
	/** 当前版本文件大小（字节） */
	fileSize: number
	/** 版本数 */
	versionCount: number
}

/** 组筛选器选项 */
export interface RecycleFilterGroup {
	id: number
	name: string
}

/** 批量操作失败项 */
export interface RecycleBatchFailedItem {
	id: number
	title: string
	reason: string
}

/** 批量恢复响应 */
export interface RecycleRestoreResult {
	restoredCount: number
	restoredIds: number[]
	failed: RecycleBatchFailedItem[]
}

/** 批量永久删除响应 */
export interface RecyclePurgeResult {
	purgedCount: number
	purgedIds: number[]
	failed: RecycleBatchFailedItem[]
}
