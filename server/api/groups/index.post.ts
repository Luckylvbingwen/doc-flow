/**
 * POST /api/groups
 * 创建组 — 创建者自动成为负责人 + 加入成员表（管理员）
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
		const parent = await prisma.doc_groups.findFirst({
			where: { id: BigInt(parentId), deleted_at: null },
			select: { id: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
		})
		if (!parent) return fail(event, 400, PARENT_GROUP_NOT_FOUND, '父组不存在')

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
		const denied = await requireCreateGroupPermission(event, scopeType, scopeRefId ?? null)
		if (denied) return denied
	}

	// 同级名称唯一性检查
	const dupCount = await prisma.doc_groups.count({
		where: {
			parent_id: parentId ? BigInt(parentId) : null,
			scope_type: effectiveScopeType,
			name,
			deleted_at: null,
		},
	})
	if (dupCount > 0) {
		return fail(event, 409, GROUP_NAME_EXISTS, '同级下已存在同名组')
	}

	const groupId = generateId()
	const memberId = generateId()
	const templateId = generateId()
	const nodeId = generateId()

	try {
		await prisma.$transaction([
			prisma.doc_groups.create({
				data: {
					id: groupId,
					parent_id: parentId ? BigInt(parentId) : null,
					scope_type: effectiveScopeType,
					scope_ref_id: effectiveScopeRefId ? BigInt(effectiveScopeRefId) : null,
					name,
					description,
					owner_user_id: BigInt(userId),
					created_by: BigInt(userId),
					approval_enabled: 1,
				},
			}),
			prisma.doc_group_members.create({
				data: {
					id: memberId,
					group_id: groupId,
					user_id: BigInt(userId),
					role: 1,           // 管理员
					source_type: 1,    // 手动添加
					immutable_flag: 1, // 不可移除
					created_by: BigInt(userId),
				},
			}),
			// PRD §244：组创建默认开启审批（mode=1 依次审批），审批人=组负责人
			prisma.doc_approval_templates.create({
				data: {
					id: templateId,
					group_id: groupId,
					mode: 1,
					timeout_hours: 24,
					enabled: 1,
					created_by: BigInt(userId),
				},
			}),
			prisma.doc_approval_template_nodes.create({
				data: {
					id: nodeId,
					template_id: templateId,
					order_no: 1,
					approver_user_id: BigInt(userId),
				},
			}),
		])
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, GROUP_NAME_EXISTS, '同级下已存在同名组')
		}
		throw error
	}

	return ok({ id: Number(groupId) }, '组创建成功')
})
