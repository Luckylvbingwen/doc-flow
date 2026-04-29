/**
 * POST /api/product-lines/:id/admins
 * 添加产品线管理员
 *
 * body: { userId: number }
 *
 * 鉴权：super_admin 或产品线负责人
 */
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import {
	INVALID_PARAMS,
	PRODUCT_LINE_NOT_FOUND,
	USER_NOT_FOUND,
	PERMISSION_DENIED,
	PRODUCT_LINE_ADMIN_EXISTS,
} from '~/server/constants/error-codes'

const bodySchema = z.object({
	userId: z.coerce.number().int().positive(),
})

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const idParam = getRouterParam(event, 'id')
	const plId = Number(idParam)
	if (!Number.isFinite(plId) || plId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '产品线 ID 无效')
	}

	const body = await readValidatedBody(event, bodySchema.parse)

	// 产品线存在性
	const pl = await prisma.doc_product_lines.findFirst({
		where: { id: BigInt(plId), deleted_at: null },
		select: { id: true, name: true, owner_user_id: true },
	})
	if (!pl) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	// 权限：super_admin 或产品线负责人
	const permDenied = await requirePermission(event, 'super_admin')
	const isOwner = pl.owner_user_id && Number(pl.owner_user_id) === user.id
	if (permDenied && !isOwner) {
		return fail(event, 403, PERMISSION_DENIED, '仅系统管理员或产品线负责人可添加管理员')
	}

	// 目标用户存在性
	const targetUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(body.userId), deleted_at: null },
		select: { id: true, name: true },
	})
	if (!targetUser) return fail(event, 404, USER_NOT_FOUND, '用户不存在')

	try {
		await prisma.doc_product_line_admins.create({
			data: {
				id: generateId(),
				product_line_id: BigInt(plId),
				user_id: BigInt(body.userId),
				created_by: BigInt(user.id),
			},
		})
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, PRODUCT_LINE_ADMIN_EXISTS, '该用户已是管理员')
		}
		throw error
	}

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.PL_ADMIN_ADD,
		targetType: 'product_line',
		targetId: plId,
		detail: { desc: `添加「${targetUser.name}」为产品线「${pl.name}」管理员` },
	})

	return ok(null, '管理员添加成功')
})
