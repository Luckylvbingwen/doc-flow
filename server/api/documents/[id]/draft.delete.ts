/**
 * DELETE /api/documents/:id/draft
 * 删除草稿（PRD §6.5.2 操作矩阵：草稿 + 我创建的 → 删除 红色）
 *
 * 规则：
 *   - 仅 owner_user_id = self 可删
 *   - 仅 status=1（草稿）可删；其他状态拒绝
 *   - 软删：status=6 已删除 / deleted_at_real=NOW() / deleted_by_user_id=self
 *   - 写 doc.draft_delete 操作日志
 *
 * 鉴权：登录即可（本接口仅操作自己的草稿）
 */
import { prisma } from '~/server/utils/prisma'
import {
	AUTH_REQUIRED,
	INVALID_PARAMS,
	DRAFT_NOT_FOUND,
	DRAFT_NOT_OWNER,
	DRAFT_NOT_DELETABLE,
} from '~/server/constants/error-codes'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

const STATUS_DRAFT = 1
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
		return fail(event, 403, DRAFT_NOT_OWNER, '仅归属人可删除草稿')
	}
	if (doc.status !== STATUS_DRAFT) {
		return fail(event, 409, DRAFT_NOT_DELETABLE, '仅草稿可删除')
	}
	if (doc.deleted_at_real) {
		return fail(event, 409, DRAFT_NOT_DELETABLE, '已在回收站，不可重复删除')
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
