/**
 * POST /api/documents
 * 新建在线 Markdown 草稿（PRD §6.3.5 新建文档）
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { createDraftSchema } from '~/server/schemas/document-editor'
import { GROUP_NOT_FOUND } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:create')
	if (permErr) return permErr
	const user = event.context.user!

	const body = await readValidatedBody(event, createDraftSchema.parse)

	if (body.groupId) {
		const group = await prisma.doc_groups.findFirst({
			where: { id: BigInt(body.groupId), deleted_at: null },
			select: { id: true },
		})
		if (!group) return fail(event, 404, GROUP_NOT_FOUND, '目标组不存在')
	}

	const docId = generateId()
	await prisma.doc_documents.create({
		data: {
			id: BigInt(docId),
			owner_user_id: BigInt(user.id),
			created_by: BigInt(user.id),
			title: body.title,
			ext: 'md',
			doc_type: 2,
			status: 1,
			group_id: body.groupId ? BigInt(body.groupId) : null,
			draft_content: '',
		},
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_UPLOAD,
		targetType: 'document',
		targetId: Number(docId),
		groupId: body.groupId,
		documentId: Number(docId),
		detail: { desc: `新建在线文档草稿「${body.title}」` },
	})

	return ok({ id: docId.toString() }, '草稿创建成功')
})
