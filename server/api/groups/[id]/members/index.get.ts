/**
 * GET /api/groups/:id/members
 * 获取组成员列表
 */
import { prisma } from '~/server/utils/prisma'
import { GROUP_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'
import type { MemberRow } from '~/server/types/group-member'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const rows = await prisma.$queryRaw<MemberRow[]>`
		SELECT
			gm.id, gm.user_id, u.name, u.email, u.avatar_url,
			gm.role, gm.source_type, gm.immutable_flag, gm.joined_at
		FROM doc_group_members gm
		JOIN doc_users u ON u.id = gm.user_id
		WHERE gm.group_id = ${id} AND gm.deleted_at IS NULL
		ORDER BY gm.immutable_flag DESC, gm.role ASC, gm.joined_at ASC
	`

	const members = rows.map(r => ({
		id: Number(r.id),
		userId: Number(r.user_id),
		name: r.name,
		email: r.email,
		avatar: r.avatar_url,
		role: r.role,
		sourceType: r.source_type,
		immutableFlag: r.immutable_flag,
		joinedAt: r.joined_at.getTime(),
	}))

	return ok(members)
})
