/**
 * 文档级权限设置弹窗类型（PRD §6.3.4）
 *
 * 接口：
 *   GET /api/documents/:id/permissions  → DocPermissionsResponse
 *   PUT /api/documents/:id/permissions  → body: DocPermissionPutBody
 */
import type { PermissionLevel } from '~/utils/permission-meta'

/** 组成员只读区行（PRD 弹窗"组权限只读区"） */
export interface DocPermissionGroupMember {
	userId: number
	name: string
	avatar: string | null
	/** 1管理员 / 2可编辑 / 3上传下载 */
	role: 1 | 2 | 3
	/** 是否组负责人，UI 渲染 "组负责人" 角标（替代 role 标签） */
	isOwner: boolean
}

/** 文档级权限自定义条目（PRD 弹窗"文档级权限区"） */
export interface DocCustomPermission {
	id: number
	userId: number
	name: string
	avatar: string | null
	/** 弹窗内可改值的两档：2可编辑 / 3上传下载 */
	permission: 2 | 3
	grantedBy: number
	grantedByName: string
	grantedAt: number
}

/** GET /api/documents/:id/permissions 响应 */
export interface DocPermissionsResponse {
	groupMembers: DocPermissionGroupMember[]
	customPerms: DocCustomPermission[]
}

/** PUT /api/documents/:id/permissions 请求 body */
export interface DocPermissionPutBody {
	perms: Array<{
		userId: number
		permission: 2 | 3
	}>
}

/** PUT 响应统计 */
export interface DocPermissionPutResult {
	inserted: number
	updated: number
	removed: number
}

/** 弹窗内本地"添加成员"草稿态：选完成员 + 默认权限，等点"添加"才进入 customPerms 列表 */
export interface DocPermissionDraftRow {
	userId: number
	name: string
	avatar: string | null
	permission: 2 | 3
	/** 是否本次会话内新加的（用于 UI 区分；提交不带此字段） */
	isNew?: boolean
}

export type { PermissionLevel }
