import { z } from 'zod'

/** 1=依次审批 / 2=会签审批 */
const approvalModeSchema = z.union([z.literal(1), z.literal(2)])
/** 0=关闭 / 1=开启 */
const approvalEnabledSchema = z.union([z.literal(0), z.literal(1)])

/** 保存审批模板 — 整包提交 */
export const saveApprovalTemplateSchema = z.object({
	approvalEnabled: approvalEnabledSchema,
	mode: approvalModeSchema,
	approverUserIds: z.array(z.number().int().positive()).min(0).max(20),
}).refine(
	(data) => {
		if (data.approvalEnabled === 1 && data.approverUserIds.length === 0) return false
		return true
	},
	{ message: '开启审批时审批人不能为空', path: ['approverUserIds'] },
).refine(
	(data) => {
		return new Set(data.approverUserIds).size === data.approverUserIds.length
	},
	{ message: '审批人不能重复', path: ['approverUserIds'] },
)

export type SaveApprovalTemplateBody = z.infer<typeof saveApprovalTemplateSchema>
