/**
 * 组审批模板 — 前端类型
 */

// 从 Zod schema 推导请求类型
export type { SaveApprovalTemplateBody } from '~/server/schemas/approval-template'

/** 审批模式文案映射 */
export const APPROVAL_MODE_MAP: Record<number, string> = {
	1: '依次审批',
	2: '会签审批',
}

/** 审批人列表项 */
export interface ApprovalApprover {
	userId: number
	name: string
	avatar: string | null
	isOwner: boolean
}

/** 审批模板读取返回 */
export interface ApprovalTemplate {
	approvalEnabled: 0 | 1
	mode: 1 | 2
	approvers: ApprovalApprover[]
}
