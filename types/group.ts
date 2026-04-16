/**
 * 文档组 & 产品线 — 前端类型
 */

/** 组详情 */
export interface GroupDetail {
	id: number
	name: string
	description: string | null
	scopeType: number
	scopeRefId: number | null
	parentId: number | null
	ownerUserId: number
	ownerName: string
	approvalEnabled: number
	fileSizeLimitMb: number
	allowedFileTypes: string | null
	fileNameRegex: string | null
	status: number
	fileCount: number
	createdBy: number
	createdAt: number
	updatedAt: number
}

/** 产品线列表项 */
export interface ProductLineItem {
	id: number
	name: string
	description: string | null
	ownerUserId: number | null
	ownerName: string | null
	status: number
	groupCount: number
	createdAt: number
}
