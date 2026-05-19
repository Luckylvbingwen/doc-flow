/**
 * POST /api/approvals/:id/approve
 * 审批通过（PRD §6.4）
 *
 * 业务：
 *   1. 权限 approval:process
 *   2. 校验：instance.status=2 审批中 + 当前节点 approver=self + action_status=1
 *   3. 事务：
 *      a) UPDATE 当前节点 action_status=2, action_comment, action_at=NOW
 *      b) 依次扫描下一级节点：若 approver=提交人本人，自动通过（系统 actor=0，log 里标注）；
 *         遇到第一个非提交人节点即停下，作为新的 current_node_order
 *      c) 若无下一个非提交人节点 → 最终完成：instance.status=3 + finished_at；
 *         doc.status=4 + current_version_id=instance.biz_id；version.published_at=NOW
 *   4. 事务外日志与通知：
 *      - 本人通过：APPROVAL_PASS（审批人 actor）
 *      - 自审跳过：APPROVAL_PASS（actor=0，detail.triggeredBy='approval.pass' + auto='self-submitter'）
 *      - 最终完成：追加 DOC_PUBLISH（actor=0）+ M3 给提交人 + M8 给组内可编辑 / 管理员
 *      - 中间级流转：M2 给下一级审批人
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { createNotification } from '~/server/utils/notify'
import { notifyPublishToGroupMembers } from '~/server/utils/document-upload'
import { freezeOldAnnotations } from '~/server/utils/annotation-freeze'
import { closeCollabRoom } from '~/server/utils/hocuspocus'
import { grantGroupMembersEditPermission } from '~/server/utils/grant-group-edit'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { APPROVAL_STATUS, NODE_ACTION } from '~/server/constants/approval'
import { approvalApproveSchema } from '~/server/schemas/approval-runtime'
import {
	AUTH_REQUIRED,
	INVALID_PARAMS,
	APPROVAL_NOT_FOUND,
	APPROVAL_NOT_APPROVER,
	APPROVAL_ALREADY_ACTED,
	DOCUMENT_STATUS_INVALID,
} from '~/server/constants/error-codes'

/** 自审自动跳过节点的 fixed comment */
const SELF_SUBMITTER_AUTO_COMMENT = '提交人自审自动通过'

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

	const body = await readValidatedBody(event, approvalApproveSchema.parse)
	const comment = body.comment?.trim() || null

	const inst = await prisma.doc_approval_instances.findUnique({
		where: { id: instanceId },
		select: {
			id: true,
			status: true,
			mode: true,
			initiator_user_id: true,
			document_id: true,
			current_node_order: true,
			biz_id: true,
			doc_documents: { select: { title: true, group_id: true } },
		},
	})
	if (!inst) return fail(event, 404, APPROVAL_NOT_FOUND, '审批不存在')
	if (inst.status !== APPROVAL_STATUS.REVIEWING) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '审批已结束，不可处理')
	}

	const isCountersign = (inst.mode ?? 1) === 2

	// ── 查找当前用户的待处理节点 ──
	let currentNode: { id: bigint; approver_user_id: bigint; action_status: number } | null

	if (isCountersign) {
		// 会签模式：查用户自己的 pending 节点（无需 current_node_order 约束）
		currentNode = await prisma.doc_approval_instance_nodes.findFirst({
			where: { instance_id: instanceId, approver_user_id: BigInt(user.id), action_status: NODE_ACTION.PENDING },
			select: { id: true, approver_user_id: true, action_status: true },
		})
	} else {
		// 依次模式：按 current_node_order 查
		if (inst.current_node_order == null) {
			return fail(event, 409, DOCUMENT_STATUS_INVALID, '审批节点状态异常')
		}
		currentNode = await prisma.doc_approval_instance_nodes.findFirst({
			where: { instance_id: instanceId, node_order: inst.current_node_order },
			select: { id: true, approver_user_id: true, action_status: true },
		})
	}

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
	const versionId = inst.biz_id

	const now = new Date()

	let isFinal = false
	let nextNode: { id: bigint, order: number, approverId: bigint } | null = null
	const autoPassedNodes: Array<{ id: bigint, order: number }> = []
	let totalLevel = 0

	if (isCountersign) {
		// ── 会签模式：当前人通过，检查是否全部通过 ──
		await prisma.$transaction(async (tx) => {
			await tx.doc_approval_instance_nodes.update({
				where: { id: currentNode!.id },
				data: {
					action_status: NODE_ACTION.APPROVED,
					action_comment: comment,
					action_at: now,
				},
			})

			// 查还有没有未处理的节点
			const pendingCount = await tx.doc_approval_instance_nodes.count({
				where: {
					instance_id: instanceId,
					action_status: NODE_ACTION.PENDING,
					id: { not: currentNode!.id },
				},
			})

			isFinal = pendingCount === 0

			if (isFinal) {
				await tx.doc_approval_instances.update({
					where: { id: instanceId },
					data: {
						status: APPROVAL_STATUS.APPROVED,
						finished_at: now,
					},
				})
				await tx.doc_documents.update({
					where: { id: documentId },
					data: {
						status: 4,
						current_version_id: versionId,
						updated_by: BigInt(user.id),
						updated_at: now,
					},
				})
				await tx.doc_document_versions.update({
					where: { id: versionId },
					data: { published_at: now },
				})
				await freezeOldAnnotations(documentId, versionId, tx)
			}
		})
	} else {
		// ── 依次模式（原逻辑） ──
		// 扫描"下一级非提交人"节点，决定流转结果
		const remainingNodes = await prisma.doc_approval_instance_nodes.findMany({
			where: {
				instance_id: instanceId,
				node_order: { gt: inst.current_node_order! },
			},
			orderBy: { node_order: 'asc' },
			select: { id: true, node_order: true, approver_user_id: true },
		})

		for (const n of remainingNodes) {
			if (n.approver_user_id === initiatorId) {
				autoPassedNodes.push({ id: n.id, order: n.node_order })
				continue
			}
			nextNode = { id: n.id, order: n.node_order, approverId: n.approver_user_id }
			break
		}
		isFinal = nextNode === null

		totalLevel = inst.current_node_order! + remainingNodes.length

		await prisma.$transaction(async (tx) => {
			// a) 本人节点通过
			await tx.doc_approval_instance_nodes.update({
				where: { id: currentNode!.id },
				data: {
					action_status: NODE_ACTION.APPROVED,
					action_comment: comment,
					action_at: now,
				},
			})

			// b) 途经的"提交人自审"节点批量自动通过
			if (autoPassedNodes.length > 0) {
				await tx.doc_approval_instance_nodes.updateMany({
					where: { id: { in: autoPassedNodes.map(n => n.id) } },
					data: {
						action_status: NODE_ACTION.APPROVED,
						action_comment: SELF_SUBMITTER_AUTO_COMMENT,
						action_at: now,
					},
				})
			}

			// c) 最终完成 or 推进到下一级
			if (isFinal) {
				await tx.doc_approval_instances.update({
					where: { id: instanceId },
					data: {
						status: APPROVAL_STATUS.APPROVED,
						finished_at: now,
					},
				})
				await tx.doc_documents.update({
					where: { id: documentId },
					data: {
						status: 4,
						current_version_id: versionId,
						updated_by: BigInt(user.id),
						updated_at: now,
					},
				})
				await tx.doc_document_versions.update({
					where: { id: versionId },
					data: { published_at: now },
				})
				await freezeOldAnnotations(documentId, versionId, tx)
			} else {
				await tx.doc_approval_instances.update({
					where: { id: instanceId },
					data: { current_node_order: nextNode!.order },
				})
			}
		})
	}

	// ─── 事务外：日志 ───
	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.APPROVAL_PASS,
		targetType: 'approval',
		targetId: Number(instanceId),
		groupId,
		documentId: Number(documentId),
		detail: {
			desc: isCountersign
				? `通过审批「${title}」（会签）`
				: `通过审批「${title}」第 ${inst.current_node_order} 级`,
			level: inst.current_node_order,
			comment: comment ?? undefined,
		},
	})

	for (const autoNode of autoPassedNodes) {
		await writeLog({
			actorUserId: 0,
			action: LOG_ACTIONS.APPROVAL_PASS,
			targetType: 'approval',
			targetId: Number(instanceId),
			groupId,
			documentId: Number(documentId),
			detail: {
				desc: `提交人自审自动通过第 ${autoNode.order} 级`,
				level: autoNode.order,
				auto: 'self-submitter',
				triggeredBy: 'approval.pass',
			},
		})
	}

	if (isFinal) {
		await writeLog({
			actorUserId: 0,
			action: LOG_ACTIONS.DOC_PUBLISH,
			targetType: 'document',
			targetId: Number(documentId),
			groupId,
			documentId: Number(documentId),
			detail: {
				desc: `文件「${title}」审批通过并发布`,
				triggeredBy: 'approval.pass',
			},
		})

		// 关闭协同编辑房间（文档已发布，不可再编辑）
		await closeCollabRoom(documentId, '审批通过，文档已发布')

		// 发布后自动为组成员分配可编辑权限
		if (groupId != null) {
			await grantGroupMembersEditPermission(documentId, groupId, Number(initiatorId))
		}

		// M3 通知提交人
		await createNotification(NOTIFICATION_TEMPLATES.M3.build({
			toUserId: initiatorId,
			fileName: title,
			fileId: documentId,
		}))

		// M8 通知组内可编辑 / 管理员（去重、不含提交人）
		if (groupId != null) {
			const version = await prisma.doc_document_versions.findUnique({
				where: { id: versionId },
				select: { version_no: true },
			})
			await notifyPublishToGroupMembers({
				groupId,
				documentId,
				title,
				versionNo: version?.version_no ?? '',
				submitterId: Number(initiatorId),
			})
		}
	} else {
		// M2 通知下一级审批人
		await createNotification(NOTIFICATION_TEMPLATES.M2.build({
			toUserId: nextNode!.approverId,
			fileName: title,
			fileId: documentId,
			currentLevel: nextNode!.order,
			totalLevel,
		}))
	}

	return ok(
		{
			id: Number(instanceId),
			status: isFinal ? 'approved' : 'reviewing' as const,
		},
		isFinal ? '审批通过，文件已发布' : '审批通过，已流转至下一级',
	)
})
