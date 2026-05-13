/**
 * GET /api/documents/:id/annotations
 * 获取文档批注列表（仅返回未删除、未解决的批注）
 */
import { prisma } from '~/server/utils/prisma'
import { DOCUMENT_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, current_version_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const rows = await prisma.doc_document_annotations.findMany({
		where: { document_id: docId, deleted_at: null },
		include: { doc_users: { select: { name: true } } },
		orderBy: { created_at: 'asc' },
	})

	const currentVersionId = doc.current_version_id

	return ok(rows.map(r => ({
		id: r.id.toString(),
		content: r.content,
		quoteText: r.quote_text ?? '',
		anchorData: r.anchor_data,
		authorName: r.doc_users?.name ?? '',
		createdAt: r.created_at.getTime(),
		status: r.status,
		resolvedAt: r.resolved_at ? r.resolved_at.getTime() : null,
		frozen: r.version_id !== null && currentVersionId !== null && r.version_id !== currentVersionId,
	})))
})
