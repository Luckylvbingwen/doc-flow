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

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'super_admin')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的产品线ID')

	// 校验存在
	const existing = await prisma.doc_product_lines.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true },
	})
	if (!existing) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	// 检查是否含组
	const groupCount = await prisma.doc_groups.count({
		where: { scope_type: 3, scope_ref_id: BigInt(id), deleted_at: null },
	})
	if (groupCount > 0) {
		return fail(event, 400, PRODUCT_LINE_HAS_GROUPS, '产品线下含文档组，请先删除')
	}

	// 软删除
	await prisma.doc_product_lines.update({
		where: { id: BigInt(id) },
		data: { deleted_at: new Date() },
	})

	return ok(null, '产品线已删除')
})
