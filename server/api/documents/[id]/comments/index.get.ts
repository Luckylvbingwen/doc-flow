/**
 * GET /api/documents/:id/comments
 * 文档评论列表（PRD §6.3.4 底部 Tab「评论」）
 *
 * 返回一级评论列表（按创建时间升序），每条含嵌套 replies。
 * 已软删除的评论过滤掉。
 */
import { prisma } from '~/server/utils/prisma'
import { INVALID_PARAMS, DOCUMENT_NOT_FOUND } from '~/server/constants/error-codes'
import { formatTime } from '~/utils/format'

interface CommentRow {
	id: bigint
	parent_id: bigint | null
	user_id: bigint
	content: string
	created_at: Date
	user_name: string
	avatar_url: string | null
}

interface CommentVO {
	id: number
	userId: number
	user: { name: string; avatar?: string }
	content: string
	time: string
	deletable: boolean
	replies: CommentVO[]
}

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	// 验证文档存在
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	// 一次查出所有评论（含回复），按创建时间升序
	const rows = await prisma.$queryRaw<CommentRow[]>`
		SELECT
			c.id, c.parent_id, c.user_id, c.content, c.created_at,
			u.name AS user_name, u.avatar_url
		FROM doc_document_comments c
		JOIN doc_users u ON u.id = c.user_id
		WHERE c.document_id = ${docId}
		  AND c.deleted_at IS NULL
		ORDER BY c.created_at ASC
	`

	// 按 parent_id 分组，组装嵌套结构
	const topLevel: CommentVO[] = []
	const replyMap = new Map<number, CommentVO[]>()

	for (const row of rows) {
		const vo: CommentVO = {
			id: Number(row.id),
			userId: Number(row.user_id),
			user: {
				name: row.user_name,
				avatar: row.avatar_url || undefined,
			},
			content: row.content,
			time: formatTime(row.created_at.getTime()),
			deletable: Number(row.user_id) === user.id,
			replies: [],
		}

		if (row.parent_id == null) {
			topLevel.push(vo)
		} else {
			const parentId = Number(row.parent_id)
			if (!replyMap.has(parentId)) replyMap.set(parentId, [])
			replyMap.get(parentId)!.push(vo)
		}
	}

	// 挂载回复
	for (const comment of topLevel) {
		comment.replies = replyMap.get(comment.id) || []
	}

	return ok(topLevel)
})
