/**
 * GET /api/users/search?keyword=xxx
 * 用户搜索（轻量版，供 @mention 等场景使用）
 *
 * 鉴权：任何已登录用户
 * 返回：最多 10 条匹配结果（id, name, avatar）
 */
import { prisma } from '~/server/utils/prisma'
import { z } from 'zod'

const querySchema = z.object({
	keyword: z.string().min(1).max(50),
})

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr

	const query = await getValidatedQuery(event, querySchema.parse)
	const like = `%${query.keyword}%`

	const rows: { id: bigint, name: string, avatar_url: string | null }[] = await prisma.$queryRaw`
		SELECT id, name, avatar_url
		FROM doc_users
		WHERE deleted_at IS NULL AND status = 1
			AND name LIKE ${like}
		ORDER BY id
		LIMIT 10
	`

	return ok(rows.map(r => ({
		id: Number(r.id),
		name: r.name,
		avatar: r.avatar_url ?? null,
	})))
})
