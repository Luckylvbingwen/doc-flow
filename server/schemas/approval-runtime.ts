import { z } from 'zod'

/**
 * POST /api/approvals 起审批
 *
 * 用于文件详情页"提交审批"按钮（草稿/已驳回 → 重新提交）
 */
export const approvalSubmitSchema = z.object({
	documentId: z.number().int().positive(),
	versionId:  z.number().int().positive(),
})
export type ApprovalSubmitBody = z.infer<typeof approvalSubmitSchema>

/**
 * POST /api/approvals/:id/approve 通过
 *
 * comment 可选（PRD 未强制）
 */
export const approvalApproveSchema = z.object({
	comment: z.string().trim().max(500).optional(),
})
export type ApprovalApproveBody = z.infer<typeof approvalApproveSchema>

/**
 * POST /api/approvals/:id/reject 驳回
 *
 * comment 必填（PRD §6.4 驳回意见不能为空）
 */
export const approvalRejectSchema = z.object({
	comment: z.string().trim().min(1, '驳回意见不能为空').max(500),
})
export type ApprovalRejectBody = z.infer<typeof approvalRejectSchema>
