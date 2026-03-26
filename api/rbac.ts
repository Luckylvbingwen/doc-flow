import type { ApiResult, PaginatedData } from '~/types/api'
import type { Permission, Role, RoleListItem, UserRoleItem } from '~/types/rbac'

// ─── 权限 ───────────────────────────────────

/** 获取全部权限列表 */
export function apiGetPermissions() {
	return useAuthFetch<ApiResult<Permission[]>>('/api/rbac/permissions')
}

// ─── 角色 ───────────────────────────────────

export interface RoleListParams {
	page?: number
	pageSize?: number
	keyword?: string
}

/** 角色分页列表 */
export function apiGetRoles(params: RoleListParams = {}) {
	const qs = new URLSearchParams()
	if (params.page) qs.set('page', String(params.page))
	if (params.pageSize) qs.set('pageSize', String(params.pageSize))
	if (params.keyword) qs.set('keyword', params.keyword)
	return useAuthFetch<ApiResult<PaginatedData<RoleListItem>>>(`/api/rbac/roles?${qs}`)
}

/** 角色详情（含已分配权限） */
export function apiGetRole(id: number) {
	return useAuthFetch<ApiResult<Role>>(`/api/rbac/roles/${id}`)
}

export interface RoleCreateParams {
	code: string
	name: string
	description?: string
	status?: number
}

/** 创建角色 */
export function apiCreateRole(params: RoleCreateParams) {
	return useAuthFetch<ApiResult>('/api/rbac/roles', {
		method: 'POST',
		body: params,
	})
}

export interface RoleUpdateParams {
	name?: string
	description?: string
	status?: number
}

/** 更新角色 */
export function apiUpdateRole(id: number, params: RoleUpdateParams) {
	return useAuthFetch<ApiResult>(`/api/rbac/roles/${id}`, {
		method: 'PUT',
		body: params,
	})
}

/** 删除角色 */
export function apiDeleteRole(id: number) {
	return useAuthFetch<ApiResult>(`/api/rbac/roles/${id}`, {
		method: 'DELETE',
	})
}

/** 设置角色权限 */
export function apiSetRolePermissions(roleId: number, permissionIds: number[]) {
	return useAuthFetch<ApiResult>(`/api/rbac/roles/${roleId}/permissions`, {
		method: 'PUT',
		body: { permissionIds },
	})
}

// ─── 用户角色 ─────────────────────────────────

export interface UserRoleListParams {
	page?: number
	pageSize?: number
	keyword?: string
	roleId?: number
}

/** 用户角色分页列表 */
export function apiGetUserRoles(params: UserRoleListParams = {}) {
	const qs = new URLSearchParams()
	if (params.page) qs.set('page', String(params.page))
	if (params.pageSize) qs.set('pageSize', String(params.pageSize))
	if (params.keyword) qs.set('keyword', params.keyword)
	if (params.roleId) qs.set('roleId', String(params.roleId))
	return useAuthFetch<ApiResult<PaginatedData<UserRoleItem>>>(`/api/rbac/user-roles?${qs}`)
}

/** 分配角色 */
export function apiAssignUserRole(userId: number, roleId: number) {
	return useAuthFetch<ApiResult>('/api/rbac/user-roles/assign', {
		method: 'POST',
		body: { userId, roleId },
	})
}

/** 撤销角色 */
export function apiRevokeUserRole(userId: number, roleId: number) {
	return useAuthFetch<ApiResult>('/api/rbac/user-roles/revoke', {
		method: 'POST',
		body: { userId, roleId },
	})
}

// ─── 用户搜索 ─────────────────────────────────

export interface UserOption {
	id: number
	name: string
	email: string | null
}

/** 搜索用户（用于选择器） */
export function apiSearchUsers(keyword: string) {
	return useAuthFetch<ApiResult<UserOption[]>>(
		`/api/rbac/users?keyword=${encodeURIComponent(keyword)}`
	)
}
