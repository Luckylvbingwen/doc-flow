/**
 * POST /api/documents/:id/annotations/:annotationId/replies
 * 添加批注回复
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { createReplySchema } from '~/server/schemas/annotation'
import { createNotifications } from '~/server/utils/notify'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { INVALID_PARAMS, ANNOTATION_FROZEN } from '~/server/constants/error-codes'

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

	// 查文档获取当前版本
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, current_version_id: true },
	})
	if (!doc) return fail(event, 400, INVALID_PARAMS, '文档不存在')

	// 查批注
	const ann = await prisma.doc_document_annotations.findFirst({
		where: { id: annId, document_id: docId, deleted_at: null },
		select: { id: true, version_id: true, is_frozen: true, quote_text: true },
	})
	if (!ann) return fail(event, 400, INVALID_PARAMS, '批注不存在')

	// 冻结检查
	const isFrozen = ann.is_frozen === 1 || (ann.version_id !== null && doc.current_version_id !== null
		&& ann.version_id !== doc.current_version_id)
	if (isFrozen) return fail(event, 409, ANNOTATION_FROZEN, '该批注已冻结，不可回复')

	const body = await readValidatedBody(event, createReplySchema.parse)
	const id = generateId()

	await prisma.doc_annotation_replies.create({
		data: {
			id,
			annotation_id: annId,
			content: body.content,
			created_by: BigInt(user.id),
		},
	})

	// 查询用户头像
	const userInfo = await prisma.doc_users.findUnique({
		where: { id: BigInt(user.id) },
		select: { avatar_url: true },
	})

	// @提及通知
	if (body.mentionedUserIds.length > 0) {
		const validIds = body.mentionedUserIds.filter(uid => uid !== user.id)
		if (validIds.length > 0) {
			await createNotifications(validIds.map(uid => NOTIFICATION_TEMPLATES.M27.build({
				toUserId: uid,
				mentioner: user.name,
				fileName: doc.title,
				fileId: doc.id,
				quoteText: ann.quote_text ?? undefined,
			})))
		}
	}

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.ANNOTATION_REPLY,
		targetType: 'document',
		targetId: Number(docId),
		documentId: Number(docId),
		detail: { desc: `回复批注`, annotationId: Number(annId) },
	})

	// 返回新回复数据
	return ok({
		id: id.toString(),
		content: body.content,
		authorName: user.name,
		authorAvatar: userInfo?.avatar_url || null,
		createdAt: Date.now(),
	}, '回复成功')
})
