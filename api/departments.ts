import type { ApiResult } from '~/types/api'

export interface DeptDetail {
	id: number
	name: string
	description: string | null
	ownerUserId: number | null
	ownerName: string | null
	feishuDepartmentId: string | null
	isSynced: boolean
	status: number
	groupCount: number
	createdAt: number
	updatedAt: number
}

export interface DeptAdminItem {
	userId: number
	name: string
	email: string | null
	avatarUrl: string | null
	isOwner: boolean
	createdAt: number
}

export interface DeptGroupItem {
	id: number
	name: string
	description: string | null
	ownerName: string | null
	fileCount: number
	memberCount: number
	updatedAt: number
}

export function apiGetDepartment(id: number) {
	return useAuthFetch<ApiResult<DeptDetail>>(`/api/departments/${id}`)
}

export function apiGetDeptAdmins(deptId: number) {
	return useAuthFetch<ApiResult<DeptAdminItem[]>>(`/api/departments/${deptId}/admins`)
}

export function apiAddDeptAdmin(deptId: number, userId: number) {
	return useAuthFetch<ApiResult<null>>(`/api/departments/${deptId}/admins`, {
		method: 'POST',
		body: { userId },
	})
}

export function apiRemoveDeptAdmin(deptId: number, userId: number) {
	return useAuthFetch<ApiResult<null>>(`/api/departments/${deptId}/admins/${userId}`, {
		method: 'DELETE',
	})
}

export function apiGetDeptGroups(deptId: number) {
	return useAuthFetch<ApiResult<DeptGroupItem[]>>(`/api/departments/${deptId}/groups`)
}
