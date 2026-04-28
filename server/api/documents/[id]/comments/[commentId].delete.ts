/**
 * DELETE /api/documents/:id/comments/:commentId
 * 删除评论（软删除，仅创建人可删）
 *
 * 如果删除的是顶层评论，其所有回复也一并软删。
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	COMMENT_NOT_FOUND,
	COMMENT_NOT_OWNER,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	const commentIdStr = getRouterParam(event, 'commentId')
	if (!idStr || !/^\d+$/.test(idStr) || !commentIdStr || !/^\d+$/.test(commentIdStr)) {
		return fail(event, 400, INVALID_PARAMS, '参数非法')
	}
	const docId = BigInt(idStr)
	const commentId = BigInt(commentIdStr)

	// 验证文档存在
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, group_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	// 验证评论存在
	const comment = await prisma.doc_document_comments.findFirst({
		where: { id: commentId, document_id: docId, deleted_at: null },
		select: { id: true, user_id: true, parent_id: true },
	})
	if (!comment) return fail(event, 404, COMMENT_NOT_FOUND, '评论不存在')

	// 仅创建人可删
	if (Number(comment.user_id) !== user.id) {
		return fail(event, 403, COMMENT_NOT_OWNER, '仅评论创建人可删除')
	}

	const now = new Date()

	// 如果是顶层评论，级联软删所有回复
	if (comment.parent_id == null) {
		await prisma.doc_document_comments.updateMany({
			where: { parent_id: commentId, deleted_at: null },
			data: { deleted_at: now },
		})
	}

	await prisma.doc_document_comments.update({
		where: { id: commentId },
		data: { deleted_at: now },
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.COMMENT_DELETE,
		targetType: 'comment',
		targetId: Number(commentId),
		groupId: doc.group_id != null ? Number(doc.group_id) : null,
		documentId: Number(docId),
		detail: { desc: `删除了「${doc.title}」中的评论` },
	})

	return ok(null, '删除成功')
})
