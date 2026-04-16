/**
 * PUT /api/product-lines/:id
 * 编辑产品线 — 仅 super_admin
 */
import { prisma } from '~/server/utils/prisma'
import { productLineUpdateSchema } from '~/server/schemas/product-line'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import {
	PRODUCT_LINE_NOT_FOUND,
	PRODUCT_LINE_NAME_EXISTS,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'
import type { ProductLineCheckRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'super_admin')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的产品线ID')

	const body = await readValidatedBody(event, productLineUpdateSchema.parse)
	if (!body.name && body.description === undefined) {
		return fail(event, 400, INVALID_PARAMS, '至少提供一个修改字段')
	}

	const rows = await prisma.$queryRaw<ProductLineCheckRow[]>`
		SELECT id, owner_user_id FROM doc_product_lines
		WHERE id = ${id} AND deleted_at IS NULL
	`
	if (!rows.length) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	const sets: string[] = []
	const params: unknown[] = []
	if (body.name) {
		sets.push('name = ?')
		params.push(body.name.trim())
	}
	if (body.description !== undefined) {
		sets.push('description = ?')
		params.push(body.description?.trim() || null)
	}

	try {
		await prisma.$executeRawUnsafe(
			`UPDATE doc_product_lines SET ${sets.join(', ')} WHERE id = ?`,
			...params,
			id,
		)
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, PRODUCT_LINE_NAME_EXISTS, '产品线名称已存在')
		}
		throw error
	}

	return ok(null, '产品线更新成功')
})
