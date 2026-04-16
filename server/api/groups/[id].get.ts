/**
 * GET /api/groups/:id
 * 组详情
 */
import { prisma } from '~/server/utils/prisma'
import { GROUP_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'
import type { GroupDetailRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const rows = await prisma.$queryRaw<GroupDetailRow[]>`
		SELECT
			g.id, g.parent_id, g.scope_type, g.scope_ref_id,
			g.name, g.description, g.owner_user_id,
			u.name AS owner_name,
			g.approval_enabled, g.file_size_limit_mb,
			g.allowed_file_types, g.file_name_regex,
			g.status,
			COALESCE(dc.cnt, 0) AS file_count,
			g.created_by, g.created_at, g.updated_at
		FROM doc_groups g
		LEFT JOIN doc_users u ON u.id = g.owner_user_id
		LEFT JOIN (
			SELECT group_id, COUNT(*) AS cnt
			FROM doc_documents
			WHERE status = 4 AND deleted_at IS NULL
			GROUP BY group_id
		) dc ON dc.group_id = g.id
		WHERE g.id = ${id} AND g.deleted_at IS NULL
	`

	if (!rows.length) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const g = rows[0]
	return ok({
		id: Number(g.id),
		name: g.name,
		description: g.description,
		scopeType: g.scope_type,
		scopeRefId: g.scope_ref_id ? Number(g.scope_ref_id) : null,
		parentId: g.parent_id ? Number(g.parent_id) : null,
		ownerUserId: Number(g.owner_user_id),
		ownerName: g.owner_name,
		approvalEnabled: g.approval_enabled,
		fileSizeLimitMb: g.file_size_limit_mb,
		allowedFileTypes: g.allowed_file_types,
		fileNameRegex: g.file_name_regex,
		status: g.status,
		fileCount: Number(g.file_count),
		createdBy: Number(g.created_by),
		createdAt: g.created_at.getTime(),
		updatedAt: g.updated_at.getTime(),
	})
})
