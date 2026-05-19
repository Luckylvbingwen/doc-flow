/**
 * DELETE /api/documents/:id/pin?groupId=xxx
 * 取消置顶
 *
 * 业务：
 *   1. 鉴权：登录 + requireMemberPermission（同 pin.post.ts）
 *   2. 幂等：
 *      - 已置顶 → 删除记录 + 写 pin.remove 日志
 *      - 未置顶 → 200 ok，不重写日志
 *
 * groupId 参数：指定取消置顶的组（引用文档在目标组取消置顶时必传）
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

	// 确定取消置顶的组：优先使用 query.groupId（引用场景），否则使用文档归属组
	const queryGroupId = getQuery(event).groupId as string | undefined
	let pinGroupId: bigint

	if (queryGroupId && /^\d+$/.test(queryGroupId)) {
		pinGroupId = BigInt(queryGroupId)
	} else {
		if (doc.group_id == null) {
			return fail(event, 404, DOCUMENT_NOT_FOUND, '文档已脱离组')
		}
		pinGroupId = doc.group_id
	}

	// 鉴权：用户需是目标组管理员
	const targetGroup = pinGroupId === doc.group_id && doc.doc_groups
		? doc.doc_groups
		: await prisma.doc_groups.findUnique({
			where: { id: pinGroupId },
			select: { scope_type: true, scope_ref_id: true, owner_user_id: true },
		})
	if (!targetGroup) {
		return fail(event, 404, INVALID_PARAMS, '目标组不存在')
	}

	const permErr = await requireMemberPermission(event, {
		scopeType: targetGroup.scope_type,
		scopeRefId: targetGroup.scope_ref_id != null ? Number(targetGroup.scope_ref_id) : null,
		ownerUserId: targetGroup.owner_user_id != null ? Number(targetGroup.owner_user_id) : null,
		groupId: Number(pinGroupId),
	})
	if (permErr) return permErr

	const existing = await prisma.doc_document_pins.findFirst({
		where: { document_id: docId, group_id: pinGroupId },
		select: { id: true },
	})
	if (!existing) return ok({ isPinned: false }, '未置顶')

	await prisma.doc_document_pins.delete({ where: { id: existing.id } })

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.PIN_REMOVE,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: Number(pinGroupId),
		documentId: Number(doc.id),
		detail: { desc: `取消置顶文件「${doc.title}」` },
	})

	return ok({ isPinned: false }, '已取消置顶')
})
