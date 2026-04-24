/**
 * GET /api/documents
 * 仓库文件列表（PRD §6.3.3 — 默认只看已发布，置顶优先 + 更新时间倒序）
 *
 * 查询见 server/schemas/document.ts documentListQuerySchema
 *   - groupId:   必填
 *   - status:    默认 4（已发布）
 *   - keyword:   可选，按 title 模糊搜
 *   - page/pageSize
 *
 * 返回附加 reviewingCount（仓库详情上方提示条用）
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { documentListQuerySchema } from '~/server/schemas/document'
import { canUserPinInGroup } from '~/server/utils/group-permission'
import type { DocumentListItem, DocumentListResponse, DocumentStatus } from '~/types/document'

interface Row {
	id: bigint
	title: string
	ext: string | null
	status: number
	updated_at: Date
	download_count: number
	owner_user_id: bigint
	owner_name: string
	version_no: string | null
	file_size: bigint | null
	is_pinned: number
	is_favorited: number
}

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const query = await getValidatedQuery(event, documentListQuerySchema.parse)
	const { groupId, status, keyword, page, pageSize } = query
	const offset = (page - 1) * pageSize

	const keywordFilter = keyword
		? Prisma.sql`AND d.title LIKE ${'%' + keyword + '%'}`
		: Prisma.empty

	const rows = await prisma.$queryRaw<Row[]>`
		SELECT
			d.id, d.title, d.ext, d.status, d.updated_at, d.download_count,
			d.owner_user_id,
			u.name AS owner_name,
			v.version_no, v.file_size,
			(p.id IS NOT NULL) AS is_pinned,
			(f.id IS NOT NULL) AS is_favorited
		FROM doc_documents d
		JOIN doc_users u ON u.id = d.owner_user_id
		LEFT JOIN doc_document_versions v ON v.id = d.current_version_id
		LEFT JOIN doc_document_pins p
			ON p.document_id = d.id AND p.group_id = ${BigInt(groupId)}
		LEFT JOIN doc_document_favorites f
			ON f.document_id = d.id AND f.user_id = ${BigInt(user.id)}
		WHERE d.group_id = ${BigInt(groupId)}
		  AND d.status = ${status}
		  AND d.deleted_at IS NULL
		  ${keywordFilter}
		ORDER BY is_pinned DESC, d.updated_at DESC
		LIMIT ${pageSize} OFFSET ${offset}
	`

	const [{ cnt: totalBig }] = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
		SELECT COUNT(*) AS cnt
		FROM doc_documents d
		WHERE d.group_id = ${BigInt(groupId)}
		  AND d.status = ${status}
		  AND d.deleted_at IS NULL
		  ${keywordFilter}
	`

	const [{ cnt: reviewingBig }] = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
		SELECT COUNT(*) AS cnt
		FROM doc_documents
		WHERE group_id = ${BigInt(groupId)}
		  AND status = 3
		  AND deleted_at IS NULL
	`

	const list: DocumentListItem[] = rows.map(r => ({
		id:            Number(r.id),
		title:         r.title,
		ext:           r.ext ?? '',
		status:        r.status as DocumentStatus,
		versionNo:     r.version_no,
		fileSize:      r.file_size != null ? Number(r.file_size) : null,
		ownerId:       Number(r.owner_user_id),
		ownerName:     r.owner_name,
		updatedAt:     r.updated_at.getTime(),
		downloadCount: r.download_count,
		isPinned:      Number(r.is_pinned) === 1,
		isFavorited:   Number(r.is_favorited) === 1,
	}))

	const canPin = await canUserPinInGroup(user.id, groupId)

	const resp: DocumentListResponse = {
		list,
		total:          Number(totalBig),
		page,
		pageSize,
		reviewingCount: Number(reviewingBig),
		canPin,
	}
	return ok(resp)
})
