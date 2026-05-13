/**
 * PUT /api/documents/:id/annotations/:annotationId
 * 更新批注内容或标记为已解决
 */
import { prisma } from '~/server/utils/prisma'
import { updateAnnotationSchema } from '~/server/schemas/annotation'
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
		select: { id: true, created_by: true, version_id: true },
	})
	if (!ann) return fail(event, 404, INVALID_PARAMS, '批注不存在')

	const isFrozen = ann.version_id !== null && doc.current_version_id !== null
		&& ann.version_id !== doc.current_version_id
	if (isFrozen) return fail(event, 409, ANNOTATION_FROZEN, '该批注已冻结，旧版本批注不可编辑')

	if (Number(ann.created_by) !== user.id) return fail(event, 403, PERMISSION_DENIED, '仅批注作者可修改')

	const body = await readValidatedBody(event, updateAnnotationSchema.parse)

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const updateData: Record<string, any> = { updated_at: new Date() }
	if (body.content !== undefined) updateData.content = body.content
	if (body.status !== undefined) {
		updateData.status = body.status
		updateData.resolved_by = BigInt(user.id)
		updateData.resolved_at = new Date()
	}

	await prisma.doc_document_annotations.update({
		where: { id: annId },
		data: updateData,
	})

	return ok(null, '已更新')
})
