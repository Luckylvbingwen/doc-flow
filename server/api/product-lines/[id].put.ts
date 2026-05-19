/**
 * PUT /api/product-lines/:id
 * 编辑产品线 — super_admin 或产品线负责人
 *
 * 支持修改 name / description / ownerUserId（负责人变更）
 * 负责人变更时自动同步：pl_head 角色 + 子组继承成员
 */
import { prisma } from '~/server/utils/prisma'
import { productLineUpdateSchema } from '~/server/schemas/product-line'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import {
	PRODUCT_LINE_NOT_FOUND,
	PRODUCT_LINE_NAME_EXISTS,
	INVALID_PARAMS,
	PERMISSION_DENIED,
} from '~/server/constants/error-codes'
import { grantRole, revokeRole, countProductLinesOwnedBy } from '~/server/utils/system-role'
import { SYSTEM_ROLE_CODES } from '~/server/constants/system-roles'
import { syncInheritedMembers } from '~/server/utils/permission-inheritance'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的产品线ID')

	const body = await readValidatedBody(event, productLineUpdateSchema.parse)
	if (!body.name && body.description === undefined && !body.ownerUserId) {
		return fail(event, 400, INVALID_PARAMS, '至少提供一个修改字段')
	}

	// 校验存在 + 取当前 owner
	const existing = await prisma.doc_product_lines.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true, owner_user_id: true, name: true },
	})
	if (!existing) return fail(event, 404, PRODUCT_LINE_NOT_FOUND, '产品线不存在')

	// 权限：super_admin 或产品线负责人
	const isSuperAdmin = !(await requirePermission(event, 'super_admin'))
	const isOwner = existing.owner_user_id && Number(existing.owner_user_id) === user.id
	if (!isSuperAdmin && !isOwner) {
		return fail(event, 403, PERMISSION_DENIED, '仅系统管理员或产品线负责人可编辑')
	}

	// 构建更新数据
	const data: Record<string, unknown> = {}
	if (body.name) data.name = body.name.trim()
	if (body.description !== undefined) data.description = body.description?.trim() || null

	const operatorId = user.id
	const oldOwnerUserId = existing.owner_user_id
	const newOwnerUserId = body.ownerUserId ? BigInt(body.ownerUserId) : null
	const ownerChanged = newOwnerUserId && (!oldOwnerUserId || oldOwnerUserId !== newOwnerUserId)

	// 如果变更负责人，校验新负责人存在
	if (ownerChanged) {
		const newOwner = await prisma.doc_users.findFirst({
			where: { id: newOwnerUserId, deleted_at: null },
			select: { id: true },
		})
		if (!newOwner) {
			return fail(event, 400, INVALID_PARAMS, '新负责人用户不存在')
		}
		data.owner_user_id = newOwnerUserId
	}

	try {
		await prisma.$transaction(async (tx) => {
			await tx.doc_product_lines.update({
				where: { id: BigInt(id) },
				data,
			})

			if (ownerChanged) {
				// 授予新负责人 pl_head 角色
				await grantRole(newOwnerUserId, SYSTEM_ROLE_CODES.PL_HEAD, {
					scopeType: 2, scopeRefId: id, createdBy: operatorId, tx,
				})

				// 如果旧负责人不再拥有任何产品线，撤销 pl_head
				if (oldOwnerUserId) {
					const otherCount = await countProductLinesOwnedBy(oldOwnerUserId, tx)
					if (otherCount === 0) {
						await revokeRole(Number(oldOwnerUserId), SYSTEM_ROLE_CODES.PL_HEAD, {
							scopeType: 2, scopeRefId: id, tx,
						})
					}
				}
			} else if (existing.owner_user_id) {
				// 幂等治愈：确保当前 owner 具备 pl_head 角色
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

	// 事务成功后同步继承成员（scope_type=3 产品线）
	if (ownerChanged) {
		await syncInheritedMembers(
			3,
			BigInt(id),
			oldOwnerUserId,
			newOwnerUserId,
			BigInt(operatorId),
		)
	}

	await writeLog({
		actorUserId: operatorId,
		action: LOG_ACTIONS.PL_UPDATE,
		targetType: 'product_line',
		targetId: id,
		detail: {
			desc: ownerChanged
				? `变更产品线「${existing.name}」负责人`
				: `编辑产品线「${body.name?.trim() || existing.name}」信息`,
			changes: data,
		},
	})

	return ok(null, ownerChanged ? '负责人已变更' : '产品线更新成功')
})
