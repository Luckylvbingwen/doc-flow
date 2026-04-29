/**
 * GET /api/product-lines/:id/admins
 * 产品线管理员列表（含负责人，标记 isOwner）
 *
 * 鉴权：pl:read（任何登录用户可查看）
 */
import { prisma } from '~/server/utils/prisma'
import {
	INVALID_PARAMS,
	PRODUCT_LINE_NOT_FOUND,
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
	const plId = Number(idParam)
	if (!Number.isFinite(plId) || plId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '产品线 ID 无效')
	}

	// 产品线存在性 + 取 owner
	const pl = await prisma.doc_product_lines.findFirst({
		where: { id: BigInt(plId), deleted_at: null },
		select: { id: true, owner_user_id: true },
	})
	if (!pl) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	const ownerUserId = pl.owner_user_id ? Number(pl.owner_user_id) : null

	// 查管理员表
	const rows = await prisma.$queryRaw<AdminRow[]>`
		SELECT
			a.user_id, u.name AS user_name, u.email AS user_email,
			u.avatar_url AS user_avatar, a.created_at
		FROM doc_product_line_admins a
		JOIN doc_users u ON u.id = a.user_id AND u.deleted_at IS NULL
		WHERE a.product_line_id = ${BigInt(plId)}
		ORDER BY a.created_at ASC
	`

	// 构造列表（负责人放首位）
	const list = rows.map(r => ({
		userId: Number(r.user_id),
		name: r.user_name,
		email: r.user_email,
		avatarUrl: r.user_avatar,
		isOwner: Number(r.user_id) === ownerUserId,
		createdAt: r.created_at.getTime(),
	}))

	// 如果负责人不在管理员表中，手动补到列表首位
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

	// 确保负责人在首位
	list.sort((a, b) => (a.isOwner ? -1 : 0) - (b.isOwner ? -1 : 0))

	return ok(list)
})
