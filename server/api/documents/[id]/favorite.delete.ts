/**
 * DELETE /api/documents/:id/favorite
 * 取消收藏
 *
 * 业务：
 *   1. 鉴权：登录即可
 *   2. 文档存在性不强制（即便文档已被永久删除，用户仍可删除自己的收藏记录）
 *   3. 幂等：
 *      - 已收藏 → 删除记录 + 写 favorite.remove 日志
 *      - 未收藏 → 200 ok，不重写日志
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import {
	AUTH_REQUIRED,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	const existing = await prisma.doc_document_favorites.findFirst({
		where: { document_id: docId, user_id: BigInt(user.id) },
		select: { id: true },
	})
	if (!existing) return ok({ isFavorited: false }, '未收藏')

	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: { id: true, title: true, group_id: true },
	})

	await prisma.doc_document_favorites.delete({ where: { id: existing.id } })

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.FAVORITE_REMOVE,
		targetType: 'document',
		targetId: Number(docId),
		groupId: doc?.group_id != null ? Number(doc.group_id) : null,
		documentId: Number(docId),
		detail: { desc: `取消收藏文件「${doc?.title ?? ''}」` },
	})

	return ok({ isFavorited: false }, '已取消收藏')
})
