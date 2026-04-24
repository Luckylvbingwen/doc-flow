import { prisma } from '~/server/utils/prisma'

/**
 * 审批路径判定结果
 *
 * - direct_publish：直接发布（无模板 / 模板未启用 / 节点为空 / 所有节点都是提交人本人）
 * - approval：走审批流程（返回完整节点列表，提交人自己的节点会在运行时被 approve handler 自动跳过）
 */
export type ApprovalPath =
	| { path: 'direct_publish' }
	| {
		path: 'approval'
		templateId: bigint
		nodes: Array<{ order: number, approverId: bigint }>
	}

/**
 * 判定文档上传 / 起审批时走哪条路径
 *
 * PRD §6.3.3：
 *   - 审批人 = 提交人 → 自动通过直接发布
 *   - 审批开关 = 关 → 直接发布
 *   - 组无模板 → 直接发布
 *   - 其他 → 起审批
 *
 * 多级链中若遇"提交人自己"的节点：节点仍保留在返回结果中，但 approve handler 在流转
 * 到该节点时会自动通过（action_status=2 + comment="提交人自审自动通过"）
 */
export async function resolveApprovalPath(params: {
	groupId: bigint
	submitterId: bigint
}): Promise<ApprovalPath> {
	const tpl = await prisma.doc_approval_templates.findFirst({
		where: {
			group_id:   params.groupId,
			enabled:    1,
			deleted_at: null,
		},
		select: { id: true },
	})
	if (!tpl) return { path: 'direct_publish' }

	const nodes = await prisma.doc_approval_template_nodes.findMany({
		where:   { template_id: tpl.id },
		orderBy: { order_no: 'asc' },
		select:  { order_no: true, approver_user_id: true },
	})
	if (nodes.length === 0) return { path: 'direct_publish' }

	// 排除"全部节点都是提交人本人"的情况（提交人自审唯一 = 直发布）
	const nonSelf = nodes.filter(n => n.approver_user_id !== params.submitterId)
	if (nonSelf.length === 0) return { path: 'direct_publish' }

	return {
		path:       'approval',
		templateId: tpl.id,
		nodes:      nodes.map(n => ({
			order:      n.order_no,
			approverId: n.approver_user_id,
		})),
	}
}
