/**
 * GET /api/approvals/:id
 * 审批实例详情（ApprovalDrawer 用，返回完整节点 + 前一版本号用于 diff）
 *
 * 鉴权：登录即可（所有参与方：发起人 / 审批人均可读）
 */
import { prisma } from '~/server/utils/prisma'
import {
	AUTH_REQUIRED,
	INVALID_PARAMS,
	APPROVAL_NOT_FOUND,
} from '~/server/constants/error-codes'

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
			biz_id: true,
			document_id: true,
			initiator_user_id: true,
			current_node_order: true,
			started_at: true,
			finished_at: true,
			doc_users: { select: { id: true, name: true } },
			doc_documents: {
				select: {
					id: true,
					title: true,
					ext: true,
					group_id: true,
					doc_groups: { select: { name: true } },
				},
			},
		},
	})
	if (!inst) return fail(event, 404, APPROVAL_NOT_FOUND, '审批不存在')

	const version = await prisma.doc_document_versions.findUnique({
		where: { id: inst.biz_id },
		select: { id: true, version_no: true, file_size: true, created_at: true },
	})

	// 上一个版本（创建时间早于当前版本）
	const prevVersion = await prisma.doc_document_versions.findFirst({
		where: {
			document_id: inst.document_id,
			deleted_at: null,
			id: { not: inst.biz_id },
		},
		orderBy: { created_at: 'desc' },
		select: { id: true, version_no: true, file_size: true },
	})

	const nodes = await prisma.doc_approval_instance_nodes.findMany({
		where: { instance_id: instanceId },
		orderBy: { node_order: 'asc' },
		select: {
			id: true,
			node_order: true,
			approver_user_id: true,
			action_status: true,
			action_comment: true,
			action_at: true,
			doc_users: { select: { id: true, name: true } },
		},
	})

	return ok({
		id:                 Number(inst.id),
		status:             inst.status,
		documentId:         Number(inst.document_id),
		title:              inst.doc_documents?.title ?? '',
		ext:                inst.doc_documents?.ext ?? '',
		groupId:            inst.doc_documents?.group_id != null ? Number(inst.doc_documents.group_id) : null,
		groupName:          inst.doc_documents?.doc_groups?.name ?? '',
		initiatorId:        Number(inst.initiator_user_id),
		initiatorName:      inst.doc_users?.name ?? '',
		versionId:          version ? Number(version.id) : null,
		versionNo:          version?.version_no ?? '',
		fileSize:           version?.file_size != null ? Number(version.file_size) : null,
		uploadedAt:         version?.created_at?.getTime() ?? null,
		currentNodeOrder:   inst.current_node_order,
		startedAt:          inst.started_at.getTime(),
		finishedAt:         inst.finished_at?.getTime() ?? null,
		prevVersion: prevVersion ? {
			id:        Number(prevVersion.id),
			versionNo: prevVersion.version_no,
			fileSize:  Number(prevVersion.file_size),
		} : null,
		nodes: nodes.map(n => ({
			id:             Number(n.id),
			order:          n.node_order,
			approverId:     Number(n.approver_user_id),
			approverName:   n.doc_users?.name ?? '',
			actionStatus:   n.action_status,
			actionComment:  n.action_comment,
			actionAt:       n.action_at?.getTime() ?? null,
		})),
	})
})
