/**
 * GET /api/product-lines
 * 产品线列表（含负责人名称和组数量）
 */
import { prisma } from '~/server/utils/prisma'
import type { ProductLineRow } from '~/server/types/group'

export default defineEventHandler(async () => {
	const rows = await prisma.$queryRaw<ProductLineRow[]>`
		SELECT
			pl.id, pl.name, pl.description, pl.owner_user_id,
			u.name AS owner_name, pl.status, pl.created_at,
			COALESCE(gc.cnt, 0) AS group_count
		FROM doc_product_lines pl
		LEFT JOIN doc_users u ON u.id = pl.owner_user_id
		LEFT JOIN (
			SELECT scope_ref_id, COUNT(*) AS cnt
			FROM doc_groups
			WHERE scope_type = 3 AND parent_id IS NULL AND deleted_at IS NULL
			GROUP BY scope_ref_id
		) gc ON gc.scope_ref_id = pl.id
		WHERE pl.deleted_at IS NULL
		ORDER BY pl.created_at ASC
	`

	const list = rows.map(pl => ({
		id: Number(pl.id),
		name: pl.name,
		description: pl.description,
		ownerUserId: pl.owner_user_id ? Number(pl.owner_user_id) : null,
		ownerName: pl.owner_name || null,
		status: pl.status,
		groupCount: Number(pl.group_count),
		createdAt: pl.created_at.getTime(),
	}))

	return ok(list)
})
