import type { ApiResult, PaginatedData } from '~/types/api'
import type { ApprovalItem, ApprovalListQuery } from '~/types/approval'

/** 审批中心列表（按 tab/status 筛选，分页） */
export function apiGetApprovals(params: ApprovalListQuery) {
	return useAuthFetch<ApiResult<PaginatedData<ApprovalItem>>>('/api/approvals', {
		method: 'GET',
		query: params,
	})
}

/** 撤回审批（仅发起人 + reviewing 状态） */
export function apiWithdrawApproval(id: number) {
	return useAuthFetch<ApiResult<{ id: number }>>(`/api/approvals/${id}/withdraw`, {
		method: 'POST',
	})
}
