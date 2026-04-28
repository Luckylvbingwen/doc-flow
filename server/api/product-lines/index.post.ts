/**
 * POST /api/product-lines
 * 创建产品线 — 仅 super_admin，创建者自动成为负责人
 *
 * 事务内同步授予 owner 的 pl_head 角色（§4.1 / §6.9 —— 保持 sys_user_roles 与 owner_user_id 一致）
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { productLineCreateSchema } from '~/server/schemas/product-line'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import { PRODUCT_LINE_NAME_EXISTS } from '~/server/constants/error-codes'
import { grantRole } from '~/server/utils/system-role'
import { SYSTEM_ROLE_CODES } from '~/server/constants/system-roles'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'super_admin')
	if (denied) return denied

	const body = await readValidatedBody(event, productLineCreateSchema.parse)
	const userId = event.context.user!.id
	const name = body.name.trim()
	const description = body.description?.trim() || null
	const id = generateId()

	try {
		await prisma.$transaction(async (tx) => {
			await tx.doc_product_lines.create({
				data: {
					id,
					name,
					description,
					owner_user_id: BigInt(userId),
					created_by: BigInt(userId),
				},
			})

			// 同事务授予 owner 的 pl_head 角色（幂等）
			await grantRole(userId, SYSTEM_ROLE_CODES.PL_HEAD, {
				scopeType: 2, scopeRefId: id, createdBy: userId, tx,
			})
		})
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, PRODUCT_LINE_NAME_EXISTS, '产品线名称已存在')
		}
		throw error
	}

	await writeLog({
		actorUserId: userId,
		action: LOG_ACTIONS.PL_CREATE,
		targetType: 'product_line',
		targetId: Number(id),
		detail: {
			desc: `创建产品线「${name}」`,
		},
	})

	return ok({ id: Number(id) }, '产品线创建成功')
})
