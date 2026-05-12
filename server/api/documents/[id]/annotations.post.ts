/**
 * POST /api/documents/:id/annotations
 * 新建批注
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { createAnnotationSchema } from '~/server/schemas/annotation'
import { DOCUMENT_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const body = await readValidatedBody(event, createAnnotationSchema.parse)
	const id = generateId()

	await prisma.doc_document_annotations.create({
		data: {
			id,
			document_id: docId,
			created_by: BigInt(user.id),
			content: body.content,
			quote_text: body.quoteText,
			anchor_data: JSON.parse(JSON.stringify(body.anchorData)),
			status: 1,
		},
	})

	return ok({ id: id.toString() }, '批注已添加')
})
