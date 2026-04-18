import { z } from 'zod'
import { APPROVAL_TABS, APPROVAL_FILTERABLE_STATUSES } from '~/server/constants/approval'

/**
 * GET /api/approvals 查询参数（PRD §6.4）
 *
 *   - tab:      必填，pending（待我审批）/ submitted（我发起的）/ handled（我已处理）
 *   - status:   可选，按状态筛选（2=审批中 / 3=已通过 / 4=已驳回 / 5=已撤回）
 *                  对 pending tab 无意义（pending 恒为审批中），前端应禁用该 tab 下的筛选
 *   - page/pageSize: 分页
 */
export const approvalListQuerySchema = z.object({
	tab:      z.enum(APPROVAL_TABS),
	status:   z.coerce.number().int().refine(
		(v) => (APPROVAL_FILTERABLE_STATUSES as readonly number[]).includes(v),
		'状态取值非法',
	).optional(),
	page:     z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export type ApprovalListQuery = z.infer<typeof approvalListQuerySchema>
