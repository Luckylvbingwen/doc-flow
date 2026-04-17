/**
 * GET /api/groups/:id/approval-template
 * 读取组审批配置。模板不存在时兜底默认（不写库）。
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { GROUP_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'
import type { ApprovalTemplateNodeRow } from '~/server/types/approval-template'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: {
			id: true,
			scope_type: true,
			scope_ref_id: true,
			owner_user_id: true,
			approval_enabled: true,
		},
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireMemberPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
		groupId: id,
	})
	if (denied) return denied

	// 查模板（若存在）
	const template = await prisma.doc_approval_templates.findFirst({
		where: { group_id: BigInt(id), deleted_at: null },
		select: { id: true, mode: true },
	})

	const ownerId = Number(group.owner_user_id)

	if (!template) {
		// 兜底：模板不存在（存量老组），返回默认值，不写库
		const owner = await prisma.doc_users.findFirst({
			where: { id: BigInt(ownerId), deleted_at: null },
			select: { id: true, name: true, avatar_url: true },
		})
		// 组负责人被软删除时，强制 approvalEnabled=0 避免"开关=开 + 审批人=空"的矛盾状态
		return ok({
			approvalEnabled: owner ? group.approval_enabled : 0,
			mode: 1,
			approvers: owner
				? [{
					userId: Number(owner.id),
					name: owner.name,
					avatar: owner.avatar_url,
					isOwner: true,
				}]
				: [],
		})
	}

	// 查审批人节点（按 order_no 排序）
	const nodes = await prisma.$queryRaw<ApprovalTemplateNodeRow[]>`
		SELECT n.order_no, n.approver_user_id, u.name, u.avatar_url
		FROM doc_approval_template_nodes n
		JOIN doc_users u ON u.id = n.approver_user_id AND u.deleted_at IS NULL
		WHERE n.template_id = ${template.id}
		ORDER BY n.order_no ASC
	`

	return ok({
		approvalEnabled: group.approval_enabled,
		mode: template.mode,
		approvers: nodes.map(n => ({
			userId: Number(n.approver_user_id),
			name: n.name,
			avatar: n.avatar_url,
			isOwner: Number(n.approver_user_id) === ownerId,
		})),
	})
})
