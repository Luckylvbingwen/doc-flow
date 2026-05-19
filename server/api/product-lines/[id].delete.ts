/**
 * DELETE /api/product-lines/:id
 * 删除产品线（软删除） — super_admin 或产品线负责人，含组时拒绝
 */
import { prisma } from '~/server/utils/prisma'
import {
	PRODUCT_LINE_NOT_FOUND,
	PRODUCT_LINE_HAS_GROUPS,
	INVALID_PARAMS,
	PERMISSION_DENIED,
} from '~/server/constants/error-codes'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的产品线ID')

	// 校验存在
	const existing = await prisma.doc_product_lines.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true, name: true, owner_user_id: true },
	})
	if (!existing) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	// 权限：super_admin 或产品线负责人
	const isSuperAdmin = !(await requirePermission(event, 'super_admin'))
	const isOwner = existing.owner_user_id && Number(existing.owner_user_id) === user.id
	if (!isSuperAdmin && !isOwner) {
		return fail(event, 403, PERMISSION_DENIED, '仅系统管理员或产品线负责人可删除')
	}

	// 检查是否含组
	const groupCount = await prisma.doc_groups.count({
		where: { scope_type: 3, scope_ref_id: BigInt(id), deleted_at: null },
	})
	if (groupCount > 0) {
		return fail(event, 400, PRODUCT_LINE_HAS_GROUPS, '产品线下含文档组，请先删除')
	}

	// 软删除
	await prisma.doc_product_lines.update({
		where: { id: BigInt(id) },
		data: { deleted_at: new Date() },
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.PL_DELETE,
		targetType: 'product_line',
		targetId: id,
		detail: {
			desc: `删除产品线「${existing.name}」`,
		},
	})

	return ok(null, '产品线已删除')
})
