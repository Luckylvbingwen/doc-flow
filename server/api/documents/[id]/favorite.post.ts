/**
 * POST /api/documents/:id/favorite
 * 收藏文档（PRD §6.3.8 / §6.5 — 个人行为，全部角色可执行）
 *
 * 业务：
 *   1. 鉴权：登录即可（只要能访问文档即可收藏）
 *   2. 文档存在 + 非软删（deleted_at / deleted_at_real 任一非空即视为不可见）
 *   3. 幂等：
 *      - 已收藏 → 200 ok，**不重写日志**（避免同一操作重复埋点）
 *      - 未收藏 → 新建收藏记录 + 写 favorite.add 日志
 *   4. 返回 { isFavorited: true } 供前端乐观更新对账
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
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
			deleted_at_real: true,
		},
	})
	if (!doc || doc.deleted_at || doc.deleted_at_real) {
		return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在或已删除')
	}

	const existing = await prisma.doc_document_favorites.findFirst({
		where: { document_id: docId, user_id: BigInt(user.id) },
		select: { id: true },
	})
	if (existing) return ok({ isFavorited: true }, '已收藏')

	await prisma.doc_document_favorites.create({
		data: {
			id: generateId(),
			document_id: docId,
			user_id: BigInt(user.id),
		},
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.FAVORITE_ADD,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: doc.group_id != null ? Number(doc.group_id) : null,
		documentId: Number(doc.id),
		detail: { desc: `收藏文件「${doc.title}」` },
	})

	return ok({ isFavorited: true }, '已收藏')
})
