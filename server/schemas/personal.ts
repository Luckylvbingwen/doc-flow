import { z } from 'zod'
import { PERSONAL_TABS, PERSONAL_FILTERABLE_STATUSES } from '~/server/constants/personal'

/**
 * GET /api/personal/documents 查询参数（PRD §6.5）
 *
 *   - tab:      必填 all/mine/shared/favorite/handover
 *   - status:   可选 1 草稿 / 2 编辑中 / 3 审批中 / 4 已发布（handover tab 忽略）
 *   - keyword:  文件名模糊搜索（≤100）
 *   - page/pageSize: 分页
 */
export const personalListQuerySchema = z.object({
	tab: z.enum(PERSONAL_TABS),
	status: z.coerce.number().int().refine(
		(v) => (PERSONAL_FILTERABLE_STATUSES as readonly number[]).includes(v),
		'状态取值非法',
	).optional(),
	keyword: z.string().trim().max(100).optional(),
	page: z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export type PersonalListQuery = z.infer<typeof personalListQuerySchema>
