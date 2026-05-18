/**
 * POST /api/documents/:id/annotations
 * 新建批注
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { createAnnotationSchema } from '~/server/schemas/annotation'
import { createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { DOCUMENT_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, current_version_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const body = await readValidatedBody(event, createAnnotationSchema.parse)
	const id = generateId()

	await prisma.doc_document_annotations.create({
		data: {
			id,
			document_id: docId,
			version_id: doc.current_version_id ?? undefined,
			created_by: BigInt(user.id),
			content: body.content,
			quote_text: body.quoteText,
			anchor_data: JSON.parse(JSON.stringify(body.anchorData)),
			status: 1,
		},
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
				quoteText: body.quoteText,
			})))
		}
	}

	return ok({ id: id.toString() }, '批注已添加')
})
