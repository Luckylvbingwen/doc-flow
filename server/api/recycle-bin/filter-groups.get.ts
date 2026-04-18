/**
 * GET /api/recycle-bin/filter-groups
 * 回收站"按组筛选"下拉数据源（RemoteSelect 远程分页）
 *
 * 只返回回收站里"当前有数据"的组（distinct），避免空选项
 * 范围过滤同 GET /api/recycle-bin
 *
 * 鉴权：recycle:read
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { recycleFilterGroupsQuerySchema } from '~/server/schemas/recycle-bin'
import { buildRecycleScopeFilter } from '~/server/utils/recycle-scope'

interface GroupRow {
	id: bigint
	name: string
}

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'recycle:read')
	if (denied) return denied

	const user = event.context.user!
	const { keyword, page, pageSize } = await getValidatedQuery(event, recycleFilterGroupsQuerySchema.parse)
	const offset = (page - 1) * pageSize

	const scopeFilter = await buildRecycleScopeFilter(user.id)

	const filters: Prisma.Sql[] = [
		Prisma.sql`d.status = 6`,
		Prisma.sql`d.deleted_at_real IS NOT NULL`,
		Prisma.sql`d.deleted_at IS NULL`,
		Prisma.sql`d.group_id IS NOT NULL`,
		scopeFilter,
	]
	if (keyword) {
		filters.push(Prisma.sql`g.name LIKE ${`%${keyword}%`}`)
	}
	const whereSql = Prisma.sql`${Prisma.join(filters, ' AND ')}`

	const countRows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
		SELECT COUNT(DISTINCT g.id) AS cnt
		FROM doc_documents d
		JOIN doc_groups g ON g.id = d.group_id
		WHERE ${whereSql}
	`
	const total = Number(countRows[0]?.cnt ?? 0)

	const rows = await prisma.$queryRaw<GroupRow[]>`
		SELECT g.id, g.name
		FROM doc_documents d
		JOIN doc_groups g ON g.id = d.group_id
		WHERE ${whereSql}
		GROUP BY g.id, g.name
		ORDER BY g.name ASC, g.id ASC
		LIMIT ${pageSize} OFFSET ${offset}
	`

	return ok({
		list: rows.map(r => ({ id: Number(r.id), name: r.name })),
		total,
		page,
		pageSize,
	})
})
