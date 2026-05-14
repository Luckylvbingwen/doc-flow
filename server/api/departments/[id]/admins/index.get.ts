/**
 * GET /api/departments/:id/admins
 * 部门管理员列表（含负责人，标记 isOwner）
 */
import { prisma } from '~/server/utils/prisma'
import {
	INVALID_PARAMS,
	DEPARTMENT_NOT_FOUND,
} from '~/server/constants/error-codes'

interface AdminRow {
	user_id: bigint
	user_name: string
	user_email: string | null
	user_avatar: string | null
	created_at: Date
}

export default defineEventHandler(async (event) => {
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

	const ownerUserId = dept.owner_user_id ? Number(dept.owner_user_id) : null

	const rows = await prisma.$queryRaw<AdminRow[]>`
		SELECT
			a.user_id, u.name AS user_name, u.email AS user_email,
			u.avatar_url AS user_avatar, a.created_at
		FROM doc_department_admins a
		JOIN doc_users u ON u.id = a.user_id AND u.deleted_at IS NULL
		WHERE a.department_id = ${BigInt(deptId)}
		ORDER BY a.created_at ASC
	`

	const list = rows.map(r => ({
		userId: Number(r.user_id),
		name: r.user_name,
		email: r.user_email,
		avatarUrl: r.user_avatar,
		isOwner: Number(r.user_id) === ownerUserId,
		createdAt: r.created_at.getTime(),
	}))

	// 负责人不在管理员表中则补到首位
	if (ownerUserId && !list.some(a => a.userId === ownerUserId)) {
		const owner = await prisma.doc_users.findFirst({
			where: { id: BigInt(ownerUserId), deleted_at: null },
			select: { id: true, name: true, email: true, avatar_url: true },
		})
		if (owner) {
			list.unshift({
				userId: Number(owner.id),
				name: owner.name,
				email: owner.email,
				avatarUrl: owner.avatar_url,
				isOwner: true,
				createdAt: 0,
			})
		}
	}

	list.sort((a, b) => (a.isOwner ? -1 : 0) - (b.isOwner ? -1 : 0))

	return ok(list)
})
