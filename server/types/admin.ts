/**
 * 系统管理（§6.9）服务端类型
 */

import type { SystemRoleCode } from '~/server/constants/system-roles'

/** 单个系统角色（用于列表 row.roles） */
export interface AdminUserRole {
	code: SystemRoleCode
	name: string
	/** dept_head 为 true（提示飞书同步只读） */
	feishuSynced: boolean
}

/** 管理范围：按角色归类 */
export interface AdminUserScopes {
	/** 是否公司层管理员 */
	companyAdmin: boolean
	/** 产品线负责人负责的产品线列表 */
	productLines: Array<{ id: number; name: string }>
	/** 部门负责人负责的部门列表（飞书同步只读） */
	departments: Array<{ id: number; name: string; feishuSynced: boolean }>
}

/** 系统管理页用户列表项 */
export interface AdminUserItem {
	id: number
	name: string
	email: string | null
	avatarUrl: string | null
	status: 0 | 1
	/** 系统角色集合（多角色并存） */
	roles: AdminUserRole[]
	/** 管理范围（按角色分类聚合） */
	scopes: AdminUserScopes
	/** 创建时间（毫秒时间戳） */
	createdAt: number
	/** 停用时间（毫秒时间戳，仅当 status=0 时） */
	deactivatedAt: number | null
}

/** GET /api/admin/users 响应 */
export interface AdminUserListResponse {
	list: AdminUserItem[]
	total: number
	page: number
	pageSize: number
}

/** DB 行（raw query 输出） */
export interface AdminUserRow {
	id: bigint
	name: string
	email: string | null
	avatar_url: string | null
	status: number
	created_at: Date
	updated_at: Date
	/** 以 JSON 字符串聚合，handler 层解析 */
	role_codes: string | null
	pl_ids_json: string | null
	dept_ids_json: string | null
}
