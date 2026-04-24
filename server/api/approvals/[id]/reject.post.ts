/**
 * POST /api/approvals/:id/reject
 * 审批驳回（PRD §6.4）
 *
 * 业务：
 *   1. 权限 approval:process
 *   2. 校验同 approve：instance.status=2 + 当前节点 approver=self + action_status=1
 *   3. comment 必填（Zod 已校验 min(1)）
 *   4. 事务：
 *      a) UPDATE 当前节点 action_status=3（驳回）+ action_comment + action_at
 *      b) UPDATE instance status=4 + finished_at
 *      c) UPDATE 文档 status=5 已驳回
 *   5. 事务外：APPROVAL_REJECT 日志 + M4 通知提交人（reason → content）
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { createNotification } from '~/server/utils/notify'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { APPROVAL_STATUS, NODE_ACTION } from '~/server/constants/approval'
import { approvalRejectSchema } from '~/server/schemas/approval-runtime'
import {
	AUTH_REQUIRED,
	INVALID_PARAMS,
	APPROVAL_NOT_FOUND,
	APPROVAL_NOT_APPROVER,
	APPROVAL_ALREADY_ACTED,
	DOCUMENT_STATUS_INVALID,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'approval:process')
	if (permErr) return permErr
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '审批 ID 非法')
	}
	const instanceId = BigInt(idStr)

	const body = await readValidatedBody(event, approvalRejectSchema.parse)
	const reason = body.comment.trim()

	const inst = await prisma.doc_approval_instances.findUnique({
		where: { id: instanceId },
		select: {
			id: true,
			status: true,
			initiator_user_id: true,
			document_id: true,
			current_node_order: true,
			doc_documents: { select: { title: true, group_id: true } },
		},
	})
	if (!inst) return fail(event, 404, APPROVAL_NOT_FOUND, '审批不存在')
	if (inst.status !== APPROVAL_STATUS.REVIEWING) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '审批已结束，不可处理')
	}
	if (inst.current_node_order == null) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '审批节点状态异常')
	}

	const currentNode = await prisma.doc_approval_instance_nodes.findFirst({
		where: { instance_id: instanceId, node_order: inst.current_node_order },
		select: { id: true, approver_user_id: true, action_status: true },
	})
	if (!currentNode) {
		return fail(event, 404, APPROVAL_NOT_FOUND, '当前节点不存在')
	}
	if (Number(currentNode.approver_user_id) !== user.id) {
		return fail(event, 403, APPROVAL_NOT_APPROVER, '您不是当前节点的待处理审批人')
	}
	if (currentNode.action_status !== NODE_ACTION.PENDING) {
		return fail(event, 409, APPROVAL_ALREADY_ACTED, '本节点已处理')
	}

	const initiatorId = inst.initiator_user_id
	const title = inst.doc_documents?.title ?? ''
	const groupId = inst.doc_documents?.group_id != null ? Number(inst.doc_documents.group_id) : null
	const documentId = inst.document_id

	const now = new Date()
	await prisma.$transaction(async (tx) => {
		await tx.doc_approval_instance_nodes.update({
			where: { id: currentNode.id },
			data: {
				action_status: NODE_ACTION.REJECTED,
				action_comment: reason,
				action_at: now,
			},
		})
		await tx.doc_approval_instances.update({
			where: { id: instanceId },
			data: {
				status: APPROVAL_STATUS.REJECTED,
				finished_at: now,
			},
		})
		await tx.doc_documents.update({
			where: { id: documentId },
			data: {
				status: 5,
				updated_by: BigInt(user.id),
				updated_at: now,
			},
		})
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.APPROVAL_REJECT,
		targetType: 'approval',
		targetId: Number(instanceId),
		groupId,
		documentId: Number(documentId),
		detail: {
			desc: `驳回审批「${title}」`,
			level: inst.current_node_order,
			reason,
		},
	})

	await createNotification(NOTIFICATION_TEMPLATES.M4.build({
		toUserId: initiatorId,
		fileName: title,
		fileId: documentId,
		reason,
	}))

	return ok(
		{
			id: Number(instanceId),
			status: 'rejected' as const,
		},
		'已驳回',
	)
})
