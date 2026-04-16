/**
 * DELETE /api/product-lines/:id
 * 删除产品线（软删除） — 仅 super_admin，含组时拒绝
 */
import { prisma } from '~/server/utils/prisma'
import {
	PRODUCT_LINE_NOT_FOUND,
	PRODUCT_LINE_HAS_GROUPS,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'
import type { ProductLineCheckRow, CountRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'super_admin')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的产品线ID')

	const rows = await prisma.$queryRaw<ProductLineCheckRow[]>`
		SELECT id, owner_user_id FROM doc_product_lines
		WHERE id = ${id} AND deleted_at IS NULL
	`
	if (!rows.length) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	const groupCount = await prisma.$queryRaw<CountRow[]>`
		SELECT COUNT(*) AS cnt FROM doc_groups
		WHERE scope_type = 3 AND scope_ref_id = ${id} AND deleted_at IS NULL
	`
	if (Number(groupCount[0]?.cnt) > 0) {
		return fail(event, 400, PRODUCT_LINE_HAS_GROUPS, '产品线下含文档组，请先删除')
	}

	await prisma.$executeRaw`
		UPDATE doc_product_lines SET deleted_at = NOW(3) WHERE id = ${id}
	`

	return ok(null, '产品线已删除')
})
