import type { ApiResult, PaginatedData } from '~/types/api'
import type { PersonalDocItem, HandoverGroup, PersonalListQuery } from '~/types/personal'

/**
 * 个人中心文档列表（tab: all/mine/shared/favorite）
 * handover tab 不走此接口 —— 用 `apiGetPersonalHandover`
 */
export function apiGetPersonalDocs(params: Omit<PersonalListQuery, 'tab'> & { tab: Exclude<PersonalListQuery['tab'], 'handover'> }) {
	return useAuthFetch<ApiResult<PaginatedData<PersonalDocItem>>>('/api/personal/documents', {
		method: 'GET',
		query: params,
	})
}

/**
 * 离职交接分组列表（handover tab 专用）
 * 仅部门负责人可访问；非部门负责人返回 403 HANDOVER_NOT_DEPT_HEAD
 */
export function apiGetPersonalHandover(params: { keyword?: string; page?: number; pageSize?: number }) {
	return useAuthFetch<ApiResult<PaginatedData<HandoverGroup>>>('/api/personal/documents', {
		method: 'GET',
		query: { ...params, tab: 'handover' as const },
	})
}

/** 删除草稿（仅 owner + status=1 生效；接口写 doc.draft_delete 日志） */
export function apiDeleteDraft(id: number) {
	return useAuthFetch<ApiResult<{ id: number }>>(`/api/documents/${id}/draft`, {
		method: 'DELETE',
	})
}
