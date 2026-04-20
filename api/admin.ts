import type { ApiResult } from '~/types/api'
import type {
	AdminUserItem, AdminUserListQuery, AdminRoleAssignPayload,
} from '~/types/admin'

interface AdminUserListResponse {
	list: AdminUserItem[]
	total: number
	page: number
	pageSize: number
}

/** 系统管理页用户列表（多角色 + 管理范围聚合） */
export function apiGetAdminUsers(params: AdminUserListQuery) {
	return useAuthFetch<ApiResult<AdminUserListResponse>>('/api/admin/users', {
		method: 'GET',
		query: params,
	})
}

/** 整包指派公司层管理员 / 产品线负责人 */
export function apiPutAdminUserRoles(userId: number, body: AdminRoleAssignPayload) {
	return useAuthFetch<ApiResult<{ changed: boolean; changes: string[] }>>(
		`/api/admin/users/${userId}/roles`,
		{ method: 'PUT', body },
	)
}

/** 飞书通讯录同步统计结果（与 server/types/feishu.ts 对齐） */
export interface FeishuSyncStats {
	total: number
	departments: number
	created: number
	updated: number
	hidden: number
	deptCreated: number
	deptUpdated: number
	docUserCreated: number
	docUserUpdated: number
	deptHeadAssigned: number
}

/** 手动触发飞书通讯录同步（admin 页面使用） */
export function apiSyncFeishuContacts() {
	return useAuthFetch<ApiResult<FeishuSyncStats>>(
		'/api/integrations/feishu/sync-contacts',
		{ method: 'POST' },
	)
}
