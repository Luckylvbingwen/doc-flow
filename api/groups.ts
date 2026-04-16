import type { ApiResult } from '~/types/api'
import type { NavTreeCategory } from '~/types/doc-nav-tree'
import type { GroupDetail } from '~/types/group'
import type { GroupCreateBody, GroupUpdateBody } from '~/server/schemas/group'

/** 获取文档组树 */
export function apiGetGroupTree() {
	return useAuthFetch<ApiResult<NavTreeCategory[]>>('/api/groups/tree')
}

/** 组详情 */
export function apiGetGroup(id: number) {
	return useAuthFetch<ApiResult<GroupDetail>>(`/api/groups/${id}`)
}

/** 创建组 */
export function apiCreateGroup(params: GroupCreateBody) {
	return useAuthFetch<ApiResult<{ id: number }>>('/api/groups', {
		method: 'POST',
		body: params,
	})
}

/** 编辑组 */
export function apiUpdateGroup(id: number, params: GroupUpdateBody) {
	return useAuthFetch<ApiResult>(`/api/groups/${id}`, {
		method: 'PUT',
		body: params,
	})
}

/** 删除组 */
export function apiDeleteGroup(id: number) {
	return useAuthFetch<ApiResult>(`/api/groups/${id}`, {
		method: 'DELETE',
	})
}
