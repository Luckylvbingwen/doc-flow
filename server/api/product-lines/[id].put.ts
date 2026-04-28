/**
 * PUT /api/product-lines/:id
 * 编辑产品线 — 仅 super_admin
 *
 * 事务内对当前 owner 做一次幂等的 pl_head 授予（治愈历史数据可能的不一致）
 */
import { prisma } from '~/server/utils/prisma'
import { productLineUpdateSchema } from '~/server/schemas/product-line'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import {
	PRODUCT_LINE_NOT_FOUND,
	PRODUCT_LINE_NAME_EXISTS,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'
import { grantRole } from '~/server/utils/system-role'
import { SYSTEM_ROLE_CODES } from '~/server/constants/system-roles'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'super_admin')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的产品线ID')

	const body = await readValidatedBody(event, productLineUpdateSchema.parse)
	if (!body.name && body.description === undefined) {
		return fail(event, 400, INVALID_PARAMS, '至少提供一个修改字段')
	}

	// 校验存在 + 取当前 owner
	const existing = await prisma.doc_product_lines.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true, owner_user_id: true },
	})
	if (!existing) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	// 构建更新数据
	const data: Record<string, unknown> = {}
	if (body.name) data.name = body.name.trim()
	if (body.description !== undefined) data.description = body.description?.trim() || null

	const operatorId = event.context.user!.id

	try {
		await prisma.$transaction(async (tx) => {
			await tx.doc_product_lines.update({
				where: { id: BigInt(id) },
				data,
			})

			// 幂等治愈：确保当前 owner 具备 pl_head 角色
			if (existing.owner_user_id) {
				await grantRole(existing.owner_user_id, SYSTEM_ROLE_CODES.PL_HEAD, {
					scopeType: 2, scopeRefId: id, createdBy: operatorId, tx,
				})
			}
		})
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, PRODUCT_LINE_NAME_EXISTS, '产品线名称已存在')
		}
		throw error
	}

	await writeLog({
		actorUserId: operatorId,
		action: LOG_ACTIONS.PL_UPDATE,
		targetType: 'product_line',
		targetId: id,
		detail: {
			desc: `编辑产品线「${body.name?.trim() || ''}」信息`,
			changes: data,
		},
	})

	return ok(null, '产品线更新成功')
})
