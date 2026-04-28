/**
 * GET /api/documents/:id/history
 * 文档级操作历史（按 document_id 过滤 doc_operation_logs）
 *
 * 任何有文档读取权限的用户均可查看（doc:read）
 * 返回按时间倒序的操作记录列表
 */
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import {
	LOG_ACTION_TO_TYPE,
} from '~/server/constants/log-actions'
import { INVALID_PARAMS, DOCUMENT_NOT_FOUND } from '~/server/constants/error-codes'

const querySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

interface LogRow {
	id: bigint
	actor_user_id: bigint
	actor_name: string | null
	action: string
	target_type: string
	target_id: bigint | null
	detail_json: unknown
	created_at: Date
}

function extractDescription(row: LogRow): string {
	const detail = row.detail_json as { desc?: string } | null
	if (detail && typeof detail.desc === 'string' && detail.desc.trim()) return detail.desc
	const parts = [row.action]
	if (row.target_type && row.target_id) parts.push(`${row.target_type}#${row.target_id}`)
	return parts.join(' · ')
}

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'doc:read')
	if (denied) return denied

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr))
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')

	const docId = BigInt(idStr)

	// 校验文档存在
	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: { id: true, deleted_at: true },
	})
	if (!doc || doc.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const query = await getValidatedQuery(event, querySchema.parse)
	const { page, pageSize } = query
	const offset = (page - 1) * pageSize

	const whereSql = Prisma.sql`l.document_id = ${docId}`

	const [{ cnt }] = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
		SELECT COUNT(*) AS cnt
		FROM doc_operation_logs l
		WHERE ${whereSql}
	`
	const total = Number(cnt ?? 0)

	const rows = await prisma.$queryRaw<LogRow[]>`
		SELECT
			l.id, l.actor_user_id, u.name AS actor_name,
			l.action, l.target_type, l.target_id,
			l.detail_json, l.created_at
		FROM doc_operation_logs l
		LEFT JOIN doc_users u ON u.id = l.actor_user_id
		WHERE ${whereSql}
		ORDER BY l.created_at DESC, l.id DESC
		LIMIT ${pageSize} OFFSET ${offset}
	`

	const list = rows.map(r => ({
		id: Number(r.id),
		type: LOG_ACTION_TO_TYPE[r.action as keyof typeof LOG_ACTION_TO_TYPE] ?? null,
		action: r.action,
		actorId: Number(r.actor_user_id),
		actorName: Number(r.actor_user_id) === 0 ? '系统' : (r.actor_name ?? '未知用户'),
		description: extractDescription(r),
		createdAt: new Date(r.created_at).getTime(),
	}))

	return ok({ list, total, page, pageSize })
})
