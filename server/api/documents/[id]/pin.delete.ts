/**
 * DELETE /api/documents/:id/pin
 * 取消置顶
 *
 * 业务：
 *   1. 鉴权：登录 + requireMemberPermission（同 pin.post.ts）
 *   2. 幂等：
 *      - 已置顶 → 删除记录 + 写 pin.remove 日志
 *      - 未置顶 → 200 ok，不重写日志
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { requireMemberPermission } from '~/server/utils/group-permission'
import {
	AUTH_REQUIRED,
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
} from '~/server/constants/error-codes'

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
			group_id: true,
			deleted_at: true,
			doc_groups: { select: { scope_type: true, scope_ref_id: true, owner_user_id: true } },
		},
	})
	if (!doc || doc.deleted_at) {
		return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	}
	if (doc.group_id == null || !doc.doc_groups) {
		// 无组信息也无从判定权限；容忍为 404
		return fail(event, 404, DOCUMENT_NOT_FOUND, '文档已脱离组')
	}

	const permErr = await requireMemberPermission(event, {
		scopeType: doc.doc_groups.scope_type,
		scopeRefId: doc.doc_groups.scope_ref_id != null ? Number(doc.doc_groups.scope_ref_id) : null,
		ownerUserId: doc.doc_groups.owner_user_id != null ? Number(doc.doc_groups.owner_user_id) : null,
		groupId: Number(doc.group_id),
	})
	if (permErr) return permErr

	const existing = await prisma.doc_document_pins.findFirst({
		where: { document_id: docId, group_id: doc.group_id },
		select: { id: true },
	})
	if (!existing) return ok({ isPinned: false }, '未置顶')

	await prisma.doc_document_pins.delete({ where: { id: existing.id } })

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.PIN_REMOVE,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: Number(doc.group_id),
		documentId: Number(doc.id),
		detail: { desc: `取消置顶文件「${doc.title}」` },
	})

	return ok({ isPinned: false }, '已取消置顶')
})
