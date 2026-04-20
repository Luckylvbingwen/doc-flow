/**
 * 系统管理（§6.9）前端类型
 */

/** 系统角色 code — 与后端 server/constants/system-roles.ts 对齐 */
export type AdminSystemRoleCode = 'super_admin' | 'company_admin' | 'pl_head' | 'dept_head'

/** 角色筛选 code — 多一个 'none'（无系统角色） */
export type AdminRoleFilterCode = AdminSystemRoleCode | 'none'

/** 用户状态筛选 */
export type AdminUserStatusFilter = 'all' | 'active' | 'deactivated'

/** 列表行：单个系统角色 */
export interface AdminUserRole {
	code: AdminSystemRoleCode
	name: string
	/** dept_head 为 true — 飞书同步只读 */
	feishuSynced: boolean
}

/** 列表行：管理范围聚合 */
export interface AdminUserScopes {
	companyAdmin: boolean
	productLines: Array<{ id: number; name: string }>
	departments: Array<{ id: number; name: string; feishuSynced: boolean }>
}

/** 用户列表项 */
export interface AdminUserItem {
	id: number
	name: string
	email: string | null
	avatarUrl: string | null
	status: 0 | 1
	roles: AdminUserRole[]
	scopes: AdminUserScopes
	createdAt: number
	deactivatedAt: number | null
}

/** 列表查询参数 */
export interface AdminUserListQuery {
	keyword?: string
	/** 逗号分隔；后端 Zod 会自动 split */
	roles?: string
	status?: AdminUserStatusFilter
	page?: number
	pageSize?: number
}

/** PUT /api/admin/users/:id/roles body */
export interface AdminRoleAssignPayload {
	companyAdmin: boolean
	plHead: boolean
}
