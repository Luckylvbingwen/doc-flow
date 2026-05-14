/**
 * GET /api/departments/:id/groups
 * 部门下属组列表
 */
import { prisma } from '~/server/utils/prisma'
import {
	INVALID_PARAMS,
	DEPARTMENT_NOT_FOUND,
} from '~/server/constants/error-codes'

interface GroupRow {
	id: bigint
	name: string
	description: string | null
	owner_name: string | null
	file_count: bigint
	member_count: bigint
	updated_at: Date
}

export default defineEventHandler(async (event) => {
	const idParam = getRouterParam(event, 'id')
	const deptId = Number(idParam)
	if (!Number.isFinite(deptId) || deptId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '部门 ID 无效')
	}

	const dept = await prisma.doc_departments.findFirst({
		where: { id: BigInt(deptId), deleted_at: null },
		select: { id: true },
	})
	if (!dept) return fail(event, 404, DEPARTMENT_NOT_FOUND, '部门不存在')

	const rows = await prisma.$queryRaw<GroupRow[]>`
		SELECT
			g.id, g.name, g.description,
			u.name AS owner_name,
			(SELECT COUNT(*) FROM doc_documents d WHERE d.group_id = g.id AND d.deleted_at IS NULL) AS file_count,
			(SELECT COUNT(*) FROM doc_group_members m WHERE m.group_id = g.id) AS member_count,
			g.updated_at
		FROM doc_groups g
		LEFT JOIN doc_users u ON u.id = g.owner_user_id AND u.deleted_at IS NULL
		WHERE g.department_id = ${BigInt(deptId)}
			AND g.deleted_at IS NULL
		ORDER BY g.name ASC
	`

	const list = rows.map(r => ({
		id: Number(r.id),
		name: r.name,
		description: r.description,
		ownerName: r.owner_name,
		fileCount: Number(r.file_count),
		memberCount: Number(r.member_count),
		updatedAt: r.updated_at.getTime(),
	}))

	return ok(list)
})
