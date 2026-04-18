import type { ApiResult, PaginatedData } from '~/types/api'
import type {
	RecycleItem,
	RecycleFilterGroup,
	RecycleRestoreResult,
	RecyclePurgeResult,
} from '~/types/recycle-bin'

export interface RecycleListQuery {
	keyword?: string
	groupId?: number
	deletedBy?: number
	startAt?: string
	endAt?: string
	page?: number
	pageSize?: number
}

export interface RecycleFilterGroupsQuery {
	keyword?: string
	page?: number
	pageSize?: number
}

/** 回收站列表（分页） */
export function apiGetRecycleList(params: RecycleListQuery = {}) {
	return useAuthFetch<ApiResult<PaginatedData<RecycleItem>>>('/api/recycle-bin', {
		method: 'GET',
		query: params,
	})
}

/** 回收站"按组筛选"下拉源（远程分页） */
export function apiGetRecycleFilterGroups(params: RecycleFilterGroupsQuery = {}) {
	return useAuthFetch<ApiResult<PaginatedData<RecycleFilterGroup>>>('/api/recycle-bin/filter-groups', {
		method: 'GET',
		query: params,
	})
}

/** 批量恢复 */
export function apiRestoreRecycle(ids: number[]) {
	return useAuthFetch<ApiResult<RecycleRestoreResult>>('/api/recycle-bin/restore', {
		method: 'POST',
		body: { ids },
	})
}

/** 批量永久删除 */
export function apiPurgeRecycle(ids: number[]) {
	return useAuthFetch<ApiResult<RecyclePurgeResult>>('/api/recycle-bin/purge', {
		method: 'POST',
		body: { ids },
	})
}
