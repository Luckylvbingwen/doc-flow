/**
 * PUT /api/groups/:id
 * 编辑组(名称、描述)
 */
import { prisma } from '~/server/utils/prisma'
import { requireGroupPermission } from '~/server/utils/group-permission'
import { groupUpdateSchema } from '~/server/schemas/group'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import { GROUP_NOT_FOUND, GROUP_NAME_EXISTS, INVALID_PARAMS } from '~/server/constants/error-codes'
import type { GroupCheckRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const body = await readValidatedBody(event, groupUpdateSchema.parse)
	if (!body.name && body.description === undefined) {
		return fail(event, 400, INVALID_PARAMS, '至少提供一个修改字段')
	}

	// 校验组存在 + 权限
	const rows = await prisma.$queryRaw<GroupCheckRow[]>`
		SELECT id, scope_type, scope_ref_id, owner_user_id
		FROM doc_groups WHERE id = ${id} AND deleted_at IS NULL
	`
	if (!rows.length) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const group = rows[0]
	const denied = await requireGroupPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
	})
	if (denied) return denied

	// 构建更新字段
	const sets: string[] = []
	const params: unknown[] = []
	if (body.name) {
		sets.push('name = ?')
		params.push(body.name.trim())
	}
	if (body.description !== undefined) {
		sets.push('description = ?')
		params.push(body.description?.trim() || null)
	}

	try {
		await prisma.$executeRawUnsafe(
			`UPDATE doc_groups SET ${sets.join(', ')} WHERE id = ?`,
			...params,
			id,
		)
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, GROUP_NAME_EXISTS, '同级下已存在同名组')
		}
		throw error
	}

	return ok(null, '组更新成功')
})
