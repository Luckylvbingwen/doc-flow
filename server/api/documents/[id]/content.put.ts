/**
 * PUT /api/documents/:id/content
 * 自动保存草稿内容（仅 doc_type=2，status=1/2）
 */
import { prisma } from '~/server/utils/prisma'
import { saveContentSchema } from '~/server/schemas/document-editor'
import { DOCUMENT_NOT_FOUND, PERMISSION_DENIED, DOCUMENT_STATUS_INVALID, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const body = await readValidatedBody(event, saveContentSchema.parse)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, doc_type: true, status: true, owner_user_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.doc_type !== 2) return fail(event, 400, INVALID_PARAMS, '该文档不是在线编辑文档')
	if (doc.status !== 1 && doc.status !== 2) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅草稿或编辑中文档可保存')
	}

	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) return fail(event, 403, PERMISSION_DENIED, '无权编辑此文档')
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const updateData: Record<string, any> = {
		draft_content: body.content,
		updated_at: new Date(),
		updated_by: BigInt(user.id),
	}
	if (body.title) updateData.title = body.title

	await prisma.doc_documents.update({ where: { id: docId }, data: updateData })

	return ok(null, '已保存')
})
