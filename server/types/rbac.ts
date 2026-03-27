/**
 * RBAC 模块 — 服务端 DB 行类型
 */

/** 角色列表查询行 */
export interface RoleListRow {
	id: bigint | number
	code: string
	name: string
	description: string | null
	is_system: number
	status: number
	permission_count: bigint | number
	user_count: bigint | number
	created_at: Date
}

/** 角色详情查询行 */
export interface RoleDetailRow {
	id: bigint | number
	code: string
	name: string
	description: string | null
	is_system: number
	status: number
	created_at: Date
}

/** 角色检查行（更新/删除前校验） */
export interface RoleCheckRow {
	is_system: number
	code?: string
}

/** 权限查询行 */
export interface PermRow {
	id: bigint | number
	code: string
	name: string
	module: string
	description: string | null
	sort_order: number
}

/** 用户简要行（下拉选择） */
export interface UserRow {
	id: bigint | number
	name: string
	email: string | null
}

/** 用户-角色关联查询行 */
export interface UserRoleRow {
	id: bigint | number
	user_id: bigint | number
	user_name: string
	user_email: string | null
	role_id: bigint | number
	role_code: string
	role_name: string
	created_at: Date
}

/** 存在性计数行 */
export interface ExistRow {
	cnt: bigint | number
}

/** 角色码行（权限工具用） */
export interface RoleCodeRow {
	code: string
}

/** 权限码行（权限工具用） */
export interface PermissionCodeRow {
	code: string
}
