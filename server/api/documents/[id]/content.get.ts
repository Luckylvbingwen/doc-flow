/**
 * GET /api/documents/:id/content
 * 加载草稿/编辑副本内容（仅 doc_type=2）
 */
import { prisma } from '~/server/utils/prisma'
import { DOCUMENT_NOT_FOUND, PERMISSION_DENIED, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, doc_type: true, draft_content: true, status: true, owner_user_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.doc_type !== 2) return fail(event, 400, INVALID_PARAMS, '该文档不是在线编辑文档')

	// 权限：归属人 或 有编辑权限（permission <= 2）
	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) return fail(event, 403, PERMISSION_DENIED, '无权编辑此文档')
	}

	return ok({
		title: doc.title,
		content: doc.draft_content ?? '',
		status: doc.status,
		docType: doc.doc_type,
	})
})
