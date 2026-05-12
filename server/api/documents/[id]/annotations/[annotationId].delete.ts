/**
 * DELETE /api/documents/:id/annotations/:annotationId
 * 软删除批注（仅作者可删）
 */
import { prisma } from '~/server/utils/prisma'
import { DOCUMENT_NOT_FOUND, INVALID_PARAMS, PERMISSION_DENIED } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	const annIdStr = getRouterParam(event, 'annotationId')
	if (!idStr || !/^\d+$/.test(idStr) || !annIdStr || !/^\d+$/.test(annIdStr)) {
		return fail(event, 400, INVALID_PARAMS, '参数非法')
	}
	const docId = BigInt(idStr)
	const annId = BigInt(annIdStr)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const ann = await prisma.doc_document_annotations.findFirst({
		where: { id: annId, document_id: docId, deleted_at: null },
		select: { id: true, created_by: true },
	})
	if (!ann) return fail(event, 404, INVALID_PARAMS, '批注不存在')
	if (Number(ann.created_by) !== user.id) return fail(event, 403, PERMISSION_DENIED, '仅批注作者可删除')

	await prisma.doc_document_annotations.update({
		where: { id: annId },
		data: { deleted_at: new Date(), updated_at: new Date() },
	})

	return ok(null, '已删除')
})
