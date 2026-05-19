/**
 * GET /api/departments/:id/groups
 * 部门下属组列表
 */
import { Prisma } from '@prisma/client'
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
	child_count: bigint
	updated_at: Date
}

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, INVALID_PARAMS, '请先登录')

	const idParam = getRouterParam(event, 'id')
	const deptId = Number(idParam)
	if (!Number.isFinite(deptId) || deptId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '部门 ID 无效')
	}

	const dept = await prisma.doc_departments.findFirst({
		where: { id: BigInt(deptId), deleted_at: null },
		select: { id: true, owner_user_id: true },
	})
	if (!dept) return fail(event, 404, DEPARTMENT_NOT_FOUND, '部门不存在')

	// 判断是否为部门负责人或超管（可见全部），否则只看自己创建的组
	const isDeptHead = dept.owner_user_id != null && Number(dept.owner_user_id) === user.id
	const isSuperAdmin = user.roles?.includes('super_admin') || user.roles?.includes('company_admin')
	const ownerFilter = (!isDeptHead && !isSuperAdmin)
		? Prisma.sql`AND g.owner_user_id = ${BigInt(user.id)}`
		: Prisma.empty

	// 顶级组（parent_id IS NULL）
	const rows = await prisma.$queryRaw<GroupRow[]>`
		SELECT
			g.id, g.name, g.description,
			u.name AS owner_name,
			(SELECT COUNT(*) FROM doc_documents d WHERE d.group_id = g.id AND d.deleted_at IS NULL) AS file_count,
			(SELECT COUNT(*) FROM doc_group_members m WHERE m.group_id = g.id) AS member_count,
			(SELECT COUNT(*) FROM doc_groups c WHERE c.parent_id = g.id AND c.deleted_at IS NULL) AS child_count,
			g.updated_at
		FROM doc_groups g
		LEFT JOIN doc_users u ON u.id = g.owner_user_id AND u.deleted_at IS NULL
		WHERE g.scope_type = 2
			AND g.scope_ref_id = ${BigInt(deptId)}
			AND g.parent_id IS NULL
			AND g.deleted_at IS NULL
			${ownerFilter}
		ORDER BY g.name ASC
	`

	// 所有组（含子组）的总数
	const [totalRow] = await prisma.$queryRaw<[{ cnt: bigint }]>`
		SELECT COUNT(*) AS cnt FROM doc_groups
		WHERE scope_type = 2 AND scope_ref_id = ${BigInt(deptId)} AND deleted_at IS NULL
	`

	const list = rows.map(r => ({
		id: Number(r.id),
		name: r.name,
		description: r.description,
		ownerName: r.owner_name,
		fileCount: Number(r.file_count),
		memberCount: Number(r.member_count),
		childCount: Number(r.child_count),
		updatedAt: r.updated_at.getTime(),
	}))

	return ok({
		groups: list,
		totalCount: Number(totalRow.cnt),
	})
})
