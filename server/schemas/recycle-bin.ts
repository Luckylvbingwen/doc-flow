import { z } from 'zod'

/**
 * GET /api/recycle-bin 查询参数（PRD §6.6.2）
 *
 * 筛选项：
 *   - keyword:     模糊搜索文件名
 *   - groupId:     按原仓库（组）筛选
 *   - deletedBy:   按删除人筛选（user.id）
 *   - startAt:     删除时间起始（YYYY-MM-DD 含当天）
 *   - endAt:       删除时间结束（YYYY-MM-DD 含当天）
 *   - page/pageSize: 分页
 */
export const recycleListQuerySchema = z.object({
	keyword: z.string().trim().max(100).optional(),
	groupId: z.coerce.number().int().positive().optional(),
	deletedBy: z.coerce.number().int().positive().optional(),
	startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式应为 YYYY-MM-DD').optional(),
	endAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式应为 YYYY-MM-DD').optional(),
	page: z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).refine(
	(v) => !v.startAt || !v.endAt || v.startAt <= v.endAt,
	{ message: '开始日期不能晚于结束日期', path: ['startAt'] },
)

export type RecycleListQuery = z.infer<typeof recycleListQuerySchema>

/**
 * GET /api/recycle-bin/filter-groups 查询参数
 *
 * RemoteSelect 远程搜索分页协议：
 *   - keyword:  组名关键词（可选，空=全部）
 *   - page/pageSize: 分页
 */
export const recycleFilterGroupsQuerySchema = z.object({
	keyword: z.string().trim().max(100).optional(),
	page: z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type RecycleFilterGroupsQuery = z.infer<typeof recycleFilterGroupsQuerySchema>

/**
 * POST /api/recycle-bin/restore / purge 批量操作 body
 *
 *   - ids: 1-50 个文档 id（数值，去重由后端处理）
 */
export const recycleBatchBodySchema = z.object({
	ids: z.array(z.coerce.number().int().positive()).min(1, '至少选择 1 项').max(50, '单次最多操作 50 项'),
})

export type RecycleBatchBody = z.infer<typeof recycleBatchBodySchema>
