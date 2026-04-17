import type { ApiResult } from '~/types/api'
import type { ApprovalTemplate, SaveApprovalTemplateBody } from '~/types/approval-template'

/** 读组审批配置 */
export function apiGetApprovalTemplate(groupId: number) {
	return useAuthFetch<ApiResult<ApprovalTemplate>>(`/api/groups/${groupId}/approval-template`)
}

/** 保存组审批配置（整包） */
export function apiSaveApprovalTemplate(groupId: number, body: SaveApprovalTemplateBody) {
	return useAuthFetch<ApiResult>(`/api/groups/${groupId}/approval-template`, {
		method: 'PUT',
		body,
	})
}
