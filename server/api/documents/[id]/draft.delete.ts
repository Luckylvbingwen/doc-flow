/**
 * DELETE /api/documents/:id/draft
 * 删除草稿 / 取消编辑（PRD §6.5.2 操作矩阵）
 *
 * 规则：
 *   - 仅 owner_user_id = self 可删
 *   - status=1（草稿）：软删除到回收站
 *   - status=2（编辑副本）：软删除（丢弃编辑副本）
 *   - 写操作日志
 *
 * 鉴权：登录即可（本接口仅操作自己的草稿/编辑副本）
 */
import { prisma } from '~/server/utils/prisma'
import { cleanupDocumentReferences } from '~/server/utils/document-reference'
import { closeCollabRoom } from '~/server/utils/hocuspocus'
import {
	AUTH_REQUIRED,
	INVALID_PARAMS,
	DRAFT_NOT_FOUND,
	DRAFT_NOT_OWNER,
	DRAFT_NOT_DELETABLE, OWNERSHIP_TRANSFER_DELETE_FORBIDDEN 
} from '~/server/constants/error-codes'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

const STATUS_DRAFT = 1
const STATUS_EDITING = 2
const STATUS_DELETED = 6

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: {
			id: true,
			title: true,
			status: true,
			owner_user_id: true,
			group_id: true,
			deleted_at: true,
			deleted_at_real: true,
		},
	})
	if (!doc || doc.deleted_at) return fail(event, 404, DRAFT_NOT_FOUND, '草稿不存在')
	if (Number(doc.owner_user_id) !== user.id) {
		return fail(event, 403, DRAFT_NOT_OWNER, '仅归属人可删除')
	}
	if (doc.status !== STATUS_DRAFT && doc.status !== STATUS_EDITING) {
		return fail(event, 409, DRAFT_NOT_DELETABLE, '仅草稿或编辑中文档可删除')
	}
	if (doc.deleted_at_real) {
		return fail(event, 409, DRAFT_NOT_DELETABLE, '已在回收站，不可重复删除')
	}

	// PRD §6.3.10 第5节：待响应转移期间不允许删除文档
	const pendingTransfer = await prisma.doc_ownership_transfers.findFirst({
		where: { document_id: docId, status: 1 },
	})
	if (pendingTransfer) {
		return fail(event, 409, OWNERSHIP_TRANSFER_DELETE_FORBIDDEN, '归属人转移请求待确认期间不允许删除')
	}

	await prisma.doc_documents.update({
		where: { id: docId },
		data: {
			status: STATUS_DELETED,
			deleted_at_real: new Date(),
			deleted_by_user_id: BigInt(user.id),
			updated_by: BigInt(user.id),
		},
	})

	// 关闭协同编辑房间（草稿已删除）
	await closeCollabRoom(Number(docId), '草稿删除')

	// PRD §6.10.6：源文档被归属人删除 → 自动失效所有引用关系 + M25 通知
	await cleanupDocumentReferences(docId)

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_DRAFT_DELETE,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: doc.group_id != null ? Number(doc.group_id) : null,
		documentId: Number(doc.id),
		detail: { desc: `删除草稿「${doc.title}」` },
	})

	return ok({ id: Number(doc.id) }, '已进入个人回收站，30天内可恢复')
})
