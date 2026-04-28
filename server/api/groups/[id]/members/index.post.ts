/**
 * POST /api/groups/:id/members
 * 批量添加组成员
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { addMembersSchema } from '~/server/schemas/group-member'
import { GROUP_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'
import { createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { PERMISSION_LABEL } from '~/utils/permission-meta'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const body = await readValidatedBody(event, addMembersSchema.parse)
	const userId = event.context.user!.id

	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true, name: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireMemberPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
		groupId: id,
	})
	if (denied) return denied

	const existingMembers = await prisma.doc_group_members.findMany({
		where: {
			group_id: BigInt(id),
			user_id: { in: body.members.map(m => BigInt(m.userId)) },
			deleted_at: null,
		},
		select: { user_id: true },
	})
	const existingUserIds = new Set(existingMembers.map(m => Number(m.user_id)))

	const toAdd = body.members.filter(m => !existingUserIds.has(m.userId))

	if (toAdd.length > 0) {
		await prisma.doc_group_members.createMany({
			data: toAdd.map(m => ({
				id: generateId(),
				group_id: BigInt(id),
				user_id: BigInt(m.userId),
				role: m.role,
				source_type: 1,
				immutable_flag: 0,
				created_by: BigInt(userId),
			})),
		})
	}

	// M18 通知：通知被添加的成员
	if (toAdd.length > 0) {
		await createNotifications(toAdd.map(m => NOTIFICATION_TEMPLATES.M18.build({
			toUserId: m.userId,
			groupName: group!.name,
			groupId: id,
			permLabel: PERMISSION_LABEL[m.role as keyof typeof PERMISSION_LABEL] || '成员',
		})))
	}

	return ok(
		{ added: toAdd.length, skipped: body.members.length - toAdd.length },
		toAdd.length > 0 ? `已添加 ${toAdd.length} 名成员` : '所选成员已在组内',
	)
})
