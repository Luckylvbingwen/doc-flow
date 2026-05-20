/**
 * DELETE /api/documents/:id/annotations/:annotationId
 * 软删除批注（仅作者可删）
 */
import { prisma } from '~/server/utils/prisma'
import { wsBroadcastAnnotationSync } from '~/server/utils/ws'
import { DOCUMENT_NOT_FOUND, INVALID_PARAMS, PERMISSION_DENIED, ANNOTATION_FROZEN } from '~/server/constants/error-codes'

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
		select: { id: true, current_version_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const ann = await prisma.doc_document_annotations.findFirst({
		where: { id: annId, document_id: docId, deleted_at: null },
		select: { id: true, created_by: true, version_id: true, is_frozen: true },
	})
	if (!ann) return fail(event, 404, INVALID_PARAMS, '批注不存在')

	const isFrozen = ann.is_frozen === 1 || (ann.version_id !== null && doc.current_version_id !== null
		&& ann.version_id !== doc.current_version_id)
	if (isFrozen) return fail(event, 409, ANNOTATION_FROZEN, '该批注已冻结，旧版本批注不可删除')

	if (Number(ann.created_by) !== user.id) return fail(event, 403, PERMISSION_DENIED, '仅批注作者可删除')

	await prisma.doc_document_annotations.update({
		where: { id: annId },
		data: { deleted_at: new Date(), updated_at: new Date() },
	})

	wsBroadcastAnnotationSync({
		documentId: Number(docId),
		action: 'deleted',
		annotationId: annId.toString(),
		actorUserId: user.id,
		timestamp: Date.now(),
	})

	return ok(null, '已删除')
})
