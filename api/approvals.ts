import type { ApiResult, PaginatedData } from '~/types/api'
import type { ApprovalItem, ApprovalListQuery, ApprovalFullDetailData } from '~/types/approval'
import type { ApprovalSubmitBody, ApprovalRejectBody } from '~/server/schemas/approval-runtime'

/** 审批中心列表（按 tab/status 筛选，分页） */
export function apiGetApprovals(params: ApprovalListQuery) {
	return useAuthFetch<ApiResult<PaginatedData<ApprovalItem>>>('/api/approvals', {
		method: 'GET',
		query: params,
	})
}

/** 审批详情（含节点 + 上一版本号，用于抽屉展示与变更摘要） */
export function apiGetApproval(id: number) {
	return useAuthFetch<ApiResult<ApprovalFullDetailData>>(`/api/approvals/${id}`)
}

/** 起审批（文件详情页"提交审批"按钮） */
export function apiSubmitApproval(body: ApprovalSubmitBody) {
	return useAuthFetch<ApiResult<{
		approvalInstanceId: number | null
		path: 'direct_publish' | 'approval'
	}>>('/api/approvals', {
		method: 'POST',
		body,
	})
}

/** 审批通过 */
export function apiApproveApproval(id: number, body: { comment?: string }) {
	return useAuthFetch<ApiResult<{ id: number, status: 'reviewing' | 'approved' }>>(
		`/api/approvals/${id}/approve`,
		{ method: 'POST', body },
	)
}

/** 审批驳回（comment 必填） */
export function apiRejectApproval(id: number, body: ApprovalRejectBody) {
	return useAuthFetch<ApiResult<{ id: number, status: 'rejected' }>>(
		`/api/approvals/${id}/reject`,
		{ method: 'POST', body },
	)
}

/** 撤回审批（仅发起人 + reviewing 状态） */
export function apiWithdrawApproval(id: number) {
	return useAuthFetch<ApiResult<{ id: number }>>(`/api/approvals/${id}/withdraw`, {
		method: 'POST',
	})
}
