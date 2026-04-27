/**
 * 文档级权限弹窗（PRD §6.3.4）请求体校验
 */
import { z } from 'zod'
import { DOC_CUSTOM_PERMISSION_LEVELS } from '~/server/constants/permission'

/**
 * PUT /api/documents/:id/permissions
 * body: 整包替换的目标列表（不在列表中的视为软删）
 *
 * 约束：
 *   - 同一 userId 不可重复
 *   - permission 仅限 [2, 3]（可编辑 / 上传下载）；可阅读(4)是分享语义不在弹窗内
 *   - 上限 200 条（远超组规模上限）
 */
export const docPermissionPutSchema = z.object({
	perms: z.array(
		z.object({
			userId: z.number().int().positive(),
			permission: z.union(
				DOC_CUSTOM_PERMISSION_LEVELS.map(v => z.literal(v)) as unknown as [z.ZodLiteral<2>, z.ZodLiteral<3>],
			),
		}),
	).max(200, '文档级权限条目数上限 200'),
}).refine((data) => {
	const ids = new Set<number>()
	for (const p of data.perms) {
		if (ids.has(p.userId)) return false
		ids.add(p.userId)
	}
	return true
}, { message: '不允许同一成员出现多条文档级权限' })

export type DocPermissionPutBody = z.infer<typeof docPermissionPutSchema>
