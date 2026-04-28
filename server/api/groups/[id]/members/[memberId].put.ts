/**
 * PUT /api/groups/:id/members/:memberId
 * 修改成员权限
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { updateMemberRoleSchema } from '~/server/schemas/group-member'
import { GROUP_NOT_FOUND, INVALID_PARAMS, MEMBER_IMMUTABLE } from '~/server/constants/error-codes'
import { createNotification } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { PERMISSION_LABEL } from '~/utils/permission-meta'

export default defineEventHandler(async (event) => {
	const groupId = Number(getRouterParam(event, 'id'))
	const memberId = Number(getRouterParam(event, 'memberId'))
	if (!groupId || isNaN(groupId) || !memberId || isNaN(memberId)) {
		return fail(event, 400, INVALID_PARAMS, '无效的参数')
	}

	const body = await readValidatedBody(event, updateMemberRoleSchema.parse)

	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(groupId), deleted_at: null },
		select: { id: true, name: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireMemberPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
		groupId,
	})
	if (denied) return denied

	const member = await prisma.doc_group_members.findFirst({
		where: { id: BigInt(memberId), group_id: BigInt(groupId), deleted_at: null },
		select: { id: true, user_id: true, role: true, immutable_flag: true },
	})
	if (!member) return fail(event, 404, INVALID_PARAMS, '成员不存在')
	if (member.immutable_flag === 1) {
		return fail(event, 403, MEMBER_IMMUTABLE, '该成员权限不可修改')
	}

	await prisma.doc_group_members.update({
		where: { id: BigInt(memberId) },
		data: { role: body.role },
	})

	// M19 通知：权限变更时通知被变更成员
	const oldRole = member!.role as keyof typeof PERMISSION_LABEL
	if (oldRole !== body.role) {
		await createNotification(NOTIFICATION_TEMPLATES.M19.build({
			toUserId: Number(member!.user_id),
			groupName: group!.name,
			oldLabel: PERMISSION_LABEL[oldRole] || '未知',
			newLabel: PERMISSION_LABEL[body.role as keyof typeof PERMISSION_LABEL] || '未知',
		}))
	}

	return ok(null, '权限已更新')
})
