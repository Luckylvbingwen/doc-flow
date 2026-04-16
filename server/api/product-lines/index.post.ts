/**
 * POST /api/product-lines
 * 创建产品线 — 仅 super_admin，创建者自动成为负责人
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { productLineCreateSchema } from '~/server/schemas/product-line'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import { PRODUCT_LINE_NAME_EXISTS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'super_admin')
	if (denied) return denied

	const body = await readValidatedBody(event, productLineCreateSchema.parse)
	const userId = event.context.user!.id
	const name = body.name.trim()
	const description = body.description?.trim() || null
	const id = generateId()

	try {
		await prisma.doc_product_lines.create({
			data: {
				id,
				name,
				description,
				owner_user_id: BigInt(userId),
				created_by: BigInt(userId),
			},
		})
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, PRODUCT_LINE_NAME_EXISTS, '产品线名称已存在')
		}
		throw error
	}

	return ok({ id: Number(id) }, '产品线创建成功')
})
