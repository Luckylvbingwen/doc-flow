/**
 * DELETE /api/groups/:id/members/:memberId
 * 移除组成员（软删除）
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { GROUP_NOT_FOUND, INVALID_PARAMS, MEMBER_IMMUTABLE, MEMBER_SELF_REMOVE } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const groupId = Number(getRouterParam(event, 'id'))
	const memberId = Number(getRouterParam(event, 'memberId'))
	if (!groupId || isNaN(groupId) || !memberId || isNaN(memberId)) {
		return fail(event, 400, INVALID_PARAMS, '无效的参数')
	}

	const userId = event.context.user!.id

	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(groupId), deleted_at: null },
		select: { id: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
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
		select: { id: true, user_id: true, immutable_flag: true },
	})
	if (!member) return fail(event, 404, INVALID_PARAMS, '成员不存在')

	if (member.immutable_flag === 1) {
		return fail(event, 403, MEMBER_IMMUTABLE, '该成员不可移除')
	}

	if (Number(member.user_id) === userId) {
		return fail(event, 400, MEMBER_SELF_REMOVE, '不可移除自己')
	}

	await prisma.doc_group_members.update({
		where: { id: BigInt(memberId) },
		data: { deleted_at: new Date() },
	})

	return ok(null, '成员已移除')
})
