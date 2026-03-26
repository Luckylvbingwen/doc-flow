/**
 * RBAC 类型定义
 * 通用权限管理模块，可跨项目复用
 */

/** 权限定义 */
export interface Permission {
	id: number
	code: string
	name: string
	module: string
	description: string | null
	sortOrder: number
}

/** 权限按模块分组 */
export interface PermissionGroup {
	module: string
	permissions: Permission[]
}

/** 角色 */
export interface Role {
	id: number
	code: string
	name: string
	description: string | null
	isSystem: boolean
	status: number
	createdAt: string
	permissions?: Permission[]
}

/** 角色列表项（含权限码） */
export interface RoleListItem {
	id: number
	code: string
	name: string
	description: string | null
	isSystem: boolean
	status: number
	permissionCount: number
	userCount: number
	createdAt: string
}

/** 角色创建/编辑表单 */
export interface RoleForm {
	code: string
	name: string
	description: string
	status: number
}

/** 用户-角色关联 */
export interface UserRoleItem {
	id: number
	userId: number
	userName: string
	userEmail: string | null
	roleId: number
	roleCode: string
	roleName: string
	createdAt: string
}

/** 当前用户配置信息（me 接口返回） */
export interface UserProfile {
	id: number
	name: string
	email: string | null
	avatar: string
	roles: Array<{ id: number; code: string; name: string }>
	permissions: string[]
}
