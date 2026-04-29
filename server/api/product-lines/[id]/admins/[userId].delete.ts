/**
 * DELETE /api/product-lines/:id/admins/:userId
 * 移除产品线管理员
 *
 * 鉴权：super_admin 或产品线负责人
 * 约束：不能移除负责人（负责人通过编辑产品线变更）
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import {
	INVALID_PARAMS,
	PRODUCT_LINE_NOT_FOUND,
	PERMISSION_DENIED,
	NOT_FOUND,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const idParam = getRouterParam(event, 'id')
	const plId = Number(idParam)
	const userIdParam = getRouterParam(event, 'userId')
	const targetUserId = Number(userIdParam)

	if (!Number.isFinite(plId) || plId <= 0 || !Number.isFinite(targetUserId) || targetUserId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '参数无效')
	}

	const pl = await prisma.doc_product_lines.findFirst({
		where: { id: BigInt(plId), deleted_at: null },
		select: { id: true, name: true, owner_user_id: true },
	})
	if (!pl) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	// 不能移除负责人
	if (pl.owner_user_id && Number(pl.owner_user_id) === targetUserId) {
		return fail(event, 403, PERMISSION_DENIED, '产品线负责人不可通过此接口移除，请变更负责人')
	}

	// 权限：super_admin 或产品线负责人
	const permDenied = await requirePermission(event, 'super_admin')
	const isOwner = pl.owner_user_id && Number(pl.owner_user_id) === user.id
	if (permDenied && !isOwner) {
		return fail(event, 403, PERMISSION_DENIED, '仅系统管理员或产品线负责人可移除管理员')
	}

	// 查找并删除
	const admin = await prisma.doc_product_line_admins.findFirst({
		where: {
			product_line_id: BigInt(plId),
			user_id: BigInt(targetUserId),
		},
		select: { id: true },
	})
	if (!admin) return fail(event, 404, NOT_FOUND, '该用户不是管理员')

	await prisma.doc_product_line_admins.delete({
		where: { id: admin.id },
	})

	// 查目标用户名用于日志
	const targetUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(targetUserId) },
		select: { name: true },
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.PL_ADMIN_REMOVE,
		targetType: 'product_line',
		targetId: plId,
		detail: { desc: `移除「${targetUser?.name ?? targetUserId}」的产品线「${pl.name}」管理员` },
	})

	return ok(null, '管理员已移除')
})
