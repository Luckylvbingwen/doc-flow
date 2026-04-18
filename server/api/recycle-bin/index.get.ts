/**
 * GET /api/recycle-bin
 * 回收站列表（PRD §6.6.2）
 *
 * 查询参数见 server/schemas/recycle-bin.ts
 * 返回 PaginatedData<RecycleItem>：按 deleted_at_real 倒序分页
 *
 * 鉴权：recycle:read
 * 数据范围：buildRecycleScopeFilter
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { recycleListQuerySchema } from '~/server/schemas/recycle-bin'
import { buildRecycleScopeFilter } from '~/server/utils/recycle-scope'

interface RecycleRow {
	id: bigint
	title: string
	ext: string | null
	group_id: bigint | null
	group_name: string | null
	owner_user_id: bigint
	deleted_by_user_id: bigint | null
	deleted_by_name: string | null
	deleted_at_real: Date
	current_version_id: bigint | null
	file_size: bigint | null
	version_count: bigint | number
}

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'recycle:read')
	if (denied) return denied

	const user = event.context.user!
	const query = await getValidatedQuery(event, recycleListQuerySchema.parse)
	const { keyword, groupId, deletedBy, startAt, endAt, page, pageSize } = query
	const offset = (page - 1) * pageSize

	const scopeFilter = await buildRecycleScopeFilter(user.id)

	const filters: Prisma.Sql[] = [
		Prisma.sql`d.status = 6`,
		Prisma.sql`d.deleted_at_real IS NOT NULL`,
		Prisma.sql`d.deleted_at IS NULL`,
		scopeFilter,
	]

	if (keyword) {
		filters.push(Prisma.sql`d.title LIKE ${`%${keyword}%`}`)
	}
	if (groupId) {
		filters.push(Prisma.sql`d.group_id = ${groupId}`)
	}
	if (deletedBy) {
		filters.push(Prisma.sql`d.deleted_by_user_id = ${deletedBy}`)
	}
	if (startAt) {
		filters.push(Prisma.sql`d.deleted_at_real >= ${`${startAt} 00:00:00`}`)
	}
	if (endAt) {
		filters.push(Prisma.sql`d.deleted_at_real < DATE_ADD(${`${endAt} 00:00:00`}, INTERVAL 1 DAY)`)
	}

	const whereSql = Prisma.sql`${Prisma.join(filters, ' AND ')}`

	const countRows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
		SELECT COUNT(*) AS cnt
		FROM doc_documents d
		WHERE ${whereSql}
	`
	const total = Number(countRows[0]?.cnt ?? 0)

	const rows = await prisma.$queryRaw<RecycleRow[]>`
		SELECT
			d.id, d.title, d.ext,
			d.group_id, g.name AS group_name,
			d.owner_user_id,
			d.deleted_by_user_id, du.name AS deleted_by_name,
			d.deleted_at_real,
			d.current_version_id, v.file_size,
			(SELECT COUNT(*) FROM doc_document_versions vc
				WHERE vc.document_id = d.id AND vc.deleted_at IS NULL) AS version_count
		FROM doc_documents d
		LEFT JOIN doc_groups            g  ON g.id = d.group_id
		LEFT JOIN doc_users             du ON du.id = d.deleted_by_user_id
		LEFT JOIN doc_document_versions v  ON v.id = d.current_version_id
		WHERE ${whereSql}
		ORDER BY d.deleted_at_real DESC, d.id DESC
		LIMIT ${pageSize} OFFSET ${offset}
	`

	const list = rows.map(r => ({
		id: Number(r.id),
		title: r.title,
		ext: r.ext ?? '',
		groupId: r.group_id != null ? Number(r.group_id) : null,
		groupName: r.group_name ?? '-',
		ownerUserId: Number(r.owner_user_id),
		deletedByUserId: r.deleted_by_user_id != null ? Number(r.deleted_by_user_id) : null,
		deletedByName: r.deleted_by_name ?? '未知用户',
		deletedAt: new Date(r.deleted_at_real).getTime(),
		fileSize: r.file_size != null ? Number(r.file_size) : 0,
		versionCount: Number(r.version_count ?? 0),
	}))

	return ok({ list, total, page, pageSize })
})
