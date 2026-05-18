/**
 * GET /api/documents/:id/annotations
 * 获取文档批注列表（含回复）
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
		include: {
			doc_users: { select: { name: true, avatar_url: true } },
			doc_annotation_replies: {
				where: { deleted_at: null },
				orderBy: { created_at: 'asc' },
				include: { doc_users: { select: { name: true, avatar_url: true } } },
			},
		},
		orderBy: { created_at: 'desc' },
	})

	const currentVersionId = doc.current_version_id

	return ok(rows.map(r => ({
		id: r.id.toString(),
		content: r.content,
		quoteText: r.quote_text ?? '',
		anchorData: r.anchor_data,
		authorName: r.doc_users?.name ?? '',
		authorAvatar: r.doc_users?.avatar_url ?? null,
		createdAt: r.created_at.getTime(),
		status: r.status,
		resolvedAt: r.resolved_at ? r.resolved_at.getTime() : null,
		frozen: r.is_frozen === 1 || (r.version_id !== null && currentVersionId !== null && r.version_id !== currentVersionId),
		replies: r.doc_annotation_replies.map(rp => ({
			id: rp.id.toString(),
			content: rp.content,
			authorName: rp.doc_users?.name ?? '',
			authorAvatar: rp.doc_users?.avatar_url ?? null,
			createdAt: rp.created_at.getTime(),
		})),
	})))
})
