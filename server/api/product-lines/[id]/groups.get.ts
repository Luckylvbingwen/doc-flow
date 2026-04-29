/**
 * GET /api/product-lines/:id/groups
 * 产品线下属项目组列表
 *
 * 返回该产品线直属（scope_type=3 + scope_ref_id=plId + parent_id IS NULL）的组，
 * 附带负责人、文件数、成员数、子组数统计。
 */
import { prisma } from '~/server/utils/prisma'
import {
	INVALID_PARAMS,
	PRODUCT_LINE_NOT_FOUND,
} from '~/server/constants/error-codes'

interface GroupRow {
	id: bigint
	name: string
	description: string | null
	owner_user_id: bigint | null
	owner_name: string | null
	file_count: bigint | number
	member_count: bigint | number
	child_count: bigint | number
	updated_at: Date
}

export default defineEventHandler(async (event) => {
	const idParam = getRouterParam(event, 'id')
	const plId = Number(idParam)
	if (!Number.isFinite(plId) || plId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '产品线 ID 无效')
	}

	const pl = await prisma.doc_product_lines.findFirst({
		where: { id: BigInt(plId), deleted_at: null },
		select: { id: true },
	})
	if (!pl) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	const rows = await prisma.$queryRaw<GroupRow[]>`
		SELECT
			g.id, g.name, g.description, g.owner_user_id,
			u.name AS owner_name,
			COALESCE(dc.cnt, 0) AS file_count,
			COALESCE(mc.cnt, 0) AS member_count,
			COALESCE(cc.cnt, 0) AS child_count,
			g.updated_at
		FROM doc_groups g
		LEFT JOIN doc_users u ON u.id = g.owner_user_id
		LEFT JOIN (
			SELECT group_id, COUNT(*) AS cnt
			FROM doc_documents WHERE deleted_at IS NULL
			GROUP BY group_id
		) dc ON dc.group_id = g.id
		LEFT JOIN (
			SELECT group_id, COUNT(*) AS cnt
			FROM doc_group_members WHERE deleted_at IS NULL
			GROUP BY group_id
		) mc ON mc.group_id = g.id
		LEFT JOIN (
			SELECT parent_id, COUNT(*) AS cnt
			FROM doc_groups WHERE deleted_at IS NULL
			GROUP BY parent_id
		) cc ON cc.parent_id = g.id
		WHERE g.scope_type = 3
			AND g.scope_ref_id = ${BigInt(plId)}
			AND g.parent_id IS NULL
			AND g.deleted_at IS NULL
		ORDER BY g.created_at ASC
	`

	const list = rows.map(r => ({
		id: Number(r.id),
		name: r.name,
		description: r.description,
		ownerUserId: r.owner_user_id ? Number(r.owner_user_id) : null,
		ownerName: r.owner_name,
		fileCount: Number(r.file_count),
		memberCount: Number(r.member_count),
		childCount: Number(r.child_count),
		updatedAt: r.updated_at.getTime(),
	}))

	return ok(list)
})
