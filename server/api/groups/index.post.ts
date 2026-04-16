/**
 * POST /api/groups
 * 创建组 -- 创建者自动成为负责人 + 加入成员表(管理员)
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { requireGroupPermission, requireCreateGroupPermission } from '~/server/utils/group-permission'
import { groupCreateSchema } from '~/server/schemas/group'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import {
	GROUP_NAME_EXISTS,
	PARENT_GROUP_NOT_FOUND,
} from '~/server/constants/error-codes'
import type { GroupCheckRow, CountRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, groupCreateSchema.parse)
	const userId = event.context.user!.id

	const name = body.name.trim()
	const description = body.description?.trim() || null
	const { scopeType, scopeRefId, parentId } = body

	let effectiveScopeType = scopeType
	let effectiveScopeRefId = scopeRefId ?? null

	// 有父组时：校验父组存在 + 继承 scope + 校验父组权限
	if (parentId) {
		const parents = await prisma.$queryRaw<GroupCheckRow[]>`
			SELECT id, scope_type, scope_ref_id, owner_user_id
			FROM doc_groups
			WHERE id = ${parentId} AND deleted_at IS NULL
		`
		if (!parents.length) return fail(event, 400, PARENT_GROUP_NOT_FOUND, '父组不存在')

		const parent = parents[0]
		// 子组继承父组的 scope
		effectiveScopeType = parent.scope_type
		effectiveScopeRefId = parent.scope_ref_id ? Number(parent.scope_ref_id) : null

		const denied = await requireGroupPermission(event, {
			scopeType: parent.scope_type,
			scopeRefId: parent.scope_ref_id ? Number(parent.scope_ref_id) : null,
			ownerUserId: Number(parent.owner_user_id),
		})
		if (denied) return denied
	} else {
		// 顶级组：校验 scope 创建权限
		const denied = await requireCreateGroupPermission(event, scopeType, scopeRefId ?? null)
		if (denied) return denied
	}

	// 同级名称唯一性检查
	let dupCount: CountRow[]
	if (parentId) {
		dupCount = await prisma.$queryRaw<CountRow[]>`
			SELECT COUNT(*) AS cnt FROM doc_groups
			WHERE parent_id = ${parentId} AND name = ${name} AND deleted_at IS NULL
		`
	} else {
		dupCount = await prisma.$queryRaw<CountRow[]>`
			SELECT COUNT(*) AS cnt FROM doc_groups
			WHERE parent_id IS NULL AND scope_type = ${effectiveScopeType}
				AND name = ${name} AND deleted_at IS NULL
		`
	}
	if (Number(dupCount[0]?.cnt) > 0) {
		return fail(event, 409, GROUP_NAME_EXISTS, '同级下已存在同名组')
	}

	const groupId = generateId()
	const memberId = generateId()

	try {
		await prisma.$transaction([
			// 创建组
			prisma.$executeRaw`
				INSERT INTO doc_groups
					(id, parent_id, scope_type, scope_ref_id, name, description,
					 owner_user_id, created_by)
				VALUES
					(${groupId}, ${parentId ?? null}, ${effectiveScopeType}, ${effectiveScopeRefId},
					 ${name}, ${description}, ${userId}, ${userId})
			`,
			// 创建者加入成员表（role=1 管理员, source_type=1 手动, immutable_flag=1）
			prisma.$executeRaw`
				INSERT INTO doc_group_members
					(id, group_id, user_id, role, source_type, immutable_flag, created_by)
				VALUES
					(${memberId}, ${groupId}, ${userId}, 1, 1, 1, ${userId})
			`,
		])
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, GROUP_NAME_EXISTS, '同级下已存在同名组')
		}
		throw error
	}

	return ok({ id: Number(groupId) }, '组创建成功')
})
