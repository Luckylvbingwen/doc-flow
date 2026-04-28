/**
 * POST /api/documents/:id/comments
 * 新增文档评论（PRD §6.3.4 底部 Tab「评论」）
 *
 * Body: { content: string, parentId?: number }
 * 规则：
 *   - 文档必须存在且未删除
 *   - parentId 若提供，父评论必须存在且属于同一文档
 *   - 写入 doc_document_comments，记操作日志
 */
import { prisma } from '~/server/utils/prisma'
import { createCommentSchema } from '~/server/schemas/comment'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { generateId } from '~/server/utils/snowflake'
import { formatTime } from '~/utils/format'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	COMMENT_PARENT_NOT_FOUND,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)
	const body = await readValidatedBody(event, createCommentSchema.parse)

	// 验证文档存在
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, group_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	// 验证父评论
	if (body.parentId) {
		const parent = await prisma.doc_document_comments.findFirst({
			where: {
				id: BigInt(body.parentId),
				document_id: docId,
				deleted_at: null,
			},
			select: { id: true },
		})
		if (!parent) return fail(event, 404, COMMENT_PARENT_NOT_FOUND, '回复的评论不存在')
	}

	const commentId = generateId()
	const now = new Date()

	await prisma.doc_document_comments.create({
		data: {
			id: commentId,
			document_id: docId,
			parent_id: body.parentId ? BigInt(body.parentId) : null,
			user_id: BigInt(user.id),
			content: body.content,
			created_at: now,
			updated_at: now,
		},
	})

	// 操作日志
	const isReply = !!body.parentId
	await writeLog({
		actorUserId: user.id,
		action: isReply ? LOG_ACTIONS.COMMENT_REPLY : LOG_ACTIONS.COMMENT_ADD,
		targetType: 'comment',
		targetId: Number(commentId),
		groupId: doc.group_id != null ? Number(doc.group_id) : null,
		documentId: Number(docId),
		detail: {
			desc: isReply
				? `回复了「${doc.title}」的评论`
				: `在「${doc.title}」中添加了评论`,
		},
	})

	// 查询创建者信息返回完整 VO
	const creator = await prisma.doc_users.findUnique({
		where: { id: BigInt(user.id) },
		select: { name: true, avatar_url: true },
	})

	return ok({
		id: Number(commentId),
		userId: user.id,
		user: {
			name: creator?.name || user.name,
			avatar: creator?.avatar_url || undefined,
		},
		content: body.content,
		time: formatTime(now.getTime()),
		deletable: true,
		replies: [],
	}, isReply ? '回复成功' : '评论成功')
})
