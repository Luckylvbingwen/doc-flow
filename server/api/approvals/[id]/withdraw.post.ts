/**
 * POST /api/approvals/:id/withdraw
 * 撤回审批（PRD §6.4.2 "我发起的" — 撤回按钮）
 *
 * 规则：
 *   - 仅发起人（inst.initiator_user_id = self）可撤回
 *   - 仅 status=2（审批中）可撤回，其他状态拒绝
 *   - 事务：UPDATE status=5 / finished_at=NOW() + 写 approval.withdraw 操作日志
 *   - 通知：M7 通知已处理过（action_status ∈ 2,3）的审批人（去重、不含提交人）
 *
 * 鉴权：登录即可（仅操作自己发起的审批）
 */
import { prisma } from '~/server/utils/prisma'
import { APPROVAL_STATUS, NODE_ACTION } from '~/server/constants/approval'
import {
	AUTH_REQUIRED,
	APPROVAL_NOT_FOUND,
	APPROVAL_NOT_INITIATOR,
	APPROVAL_NOT_WITHDRAWABLE,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '审批 ID 非法')
	}
	const instanceId = BigInt(idStr)

	const inst = await prisma.doc_approval_instances.findUnique({
		where: { id: instanceId },
		select: {
			id: true,
			status: true,
			initiator_user_id: true,
			document_id: true,
			doc_documents: { select: { title: true, group_id: true } },
		},
	})

	if (!inst) return fail(event, 404, APPROVAL_NOT_FOUND, '审批不存在')
	if (Number(inst.initiator_user_id) !== user.id) {
		return fail(event, 403, APPROVAL_NOT_INITIATOR, '仅发起人可撤回')
	}
	if (inst.status !== APPROVAL_STATUS.REVIEWING) {
		return fail(event, 409, APPROVAL_NOT_WITHDRAWABLE, '当前状态不可撤回')
	}

	await prisma.doc_approval_instances.update({
		where: { id: instanceId },
		data: {
			status: APPROVAL_STATUS.WITHDRAWN,
			finished_at: new Date(),
		},
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.APPROVAL_WITHDRAW,
		targetType: 'approval',
		targetId: Number(inst.id),
		groupId: inst.doc_documents?.group_id != null ? Number(inst.doc_documents.group_id) : null,
		documentId: Number(inst.document_id),
		detail: { desc: `撤回审批「${inst.doc_documents?.title ?? ''}」` },
	})

	// M7 通知已处理过的审批人（去重、不含提交人本人）
	const handled = await prisma.doc_approval_instance_nodes.findMany({
		where: {
			instance_id: instanceId,
			action_status: { in: [NODE_ACTION.APPROVED, NODE_ACTION.REJECTED] },
			approver_user_id: { not: inst.initiator_user_id },
		},
		distinct: ['approver_user_id'],
		select: { approver_user_id: true },
	})
	if (handled.length > 0) {
		await createNotifications(handled.map(n => NOTIFICATION_TEMPLATES.M7.build({
			toUserId: n.approver_user_id,
			submitter: user.name ?? '',
			fileName: inst.doc_documents?.title ?? '',
			fileId: inst.document_id,
		})))
	}

	return ok({ id: Number(inst.id) }, '已撤回审批')
})
