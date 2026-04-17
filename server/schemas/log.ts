import { z } from 'zod'
import { LOG_TYPES } from '~/server/constants/log-actions'

/**
 * GET /api/logs 查询参数
 *
 * 筛选项（PRD §6.7.1）:
 *   - type:     14 大类之一，缺省=全部
 *   - keyword:  模糊搜索操作人/描述/组名
 *   - startAt:  起始日期（YYYY-MM-DD，含当天）
 *   - endAt:    结束日期（YYYY-MM-DD，含当天）
 *   - page/pageSize: 分页
 */
export const logListQuerySchema = z.object({
	type: z.enum(LOG_TYPES).optional(),
	keyword: z.string().trim().max(100).optional(),
	startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式应为 YYYY-MM-DD').optional(),
	endAt:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式应为 YYYY-MM-DD').optional(),
	page:     z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).refine(
	(v) => !v.startAt || !v.endAt || v.startAt <= v.endAt,
	{ message: '开始日期不能晚于结束日期', path: ['startAt'] },
)

export type LogListQuery = z.infer<typeof logListQuerySchema>
