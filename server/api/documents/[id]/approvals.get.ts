/**
 * GET /api/documents/:id/approvals
 * 单文档审批历史（PRD §6.3.4 底部 TAB「审批记录」）
 *
 * 与 /api/approvals 区别：
 *   - /api/approvals       ：以"人"为中心，按 tab(pending/submitted/handled) 过滤
 *   - 本接口               ：以"文档"为中心，列出该文档的全部审批实例（含进行中）
 *
 * 鉴权：登录 + doc:read（与文件详情页一致），不再额外限组成员
 *   —— 能看到文件详情页就能看完整审批记录，无敏感信息泄露问题
 *
 * 排序：按 inst.created_at DESC（最新提交在前）
 * 不分页：单文档审批量级一般 < 20 条，前端一次拿完
 *
 * 返回字段集与 /api/approvals 列表项一致（ApprovalItem），
 * 但 canWithdraw 恒为 false（撤回入口在审批中心，详情页只读）
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import {
	APPROVAL_STATUS,
	NODE_ACTION,
	CHANGE_TYPE,
	type ChangeTypeCode,
} from '~/server/constants/approval'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
} from '~/server/constants/error-codes'

interface Row {
	instance_id: bigint
	status: number
	document_id: bigint
	title: string
	ext: string | null
	biz_id: bigint
	version_no: string | null
	group_id: bigint | null
	group_name: string | null
	initiator_id: bigint
	initiator_name: string | null
	submitted_at: Date
	finished_at: Date | null
	current_approver_name: string | null
	all_approver_names: string | null
	reject_reason: string | null
	remind_count: number | null
	is_first_version: number
}

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	// 文档存在性校验（已删除 / 不存在 → 404，与 /api/documents/:id 一致）
	const docExist = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true },
	})
	if (!docExist) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	// 子查询（与 /api/approvals 同款）
	const currentApproverSql = Prisma.sql`(
		SELECT cu.name FROM doc_approval_instance_nodes nn
		JOIN doc_users cu ON cu.id = nn.approver_user_id
		WHERE nn.instance_id = inst.id AND nn.node_order = inst.current_node_order
		LIMIT 1
	)`

	const allApproverSql = Prisma.sql`(
		SELECT GROUP_CONCAT(au.name ORDER BY nn.node_order SEPARATOR ',')
		FROM doc_approval_instance_nodes nn
		JOIN doc_users au ON au.id = nn.approver_user_id
		WHERE nn.instance_id = inst.id
	)`

	const remindCountSql = Prisma.sql`(
		SELECT nn.remind_count FROM doc_approval_instance_nodes nn
		WHERE nn.instance_id = inst.id AND nn.node_order = inst.current_node_order
		LIMIT 1
	)`

	// 最后一条驳回意见
	const rejectReasonSql = Prisma.sql`(
		SELECT nn.action_comment
		FROM doc_approval_instance_nodes nn
		WHERE nn.instance_id = inst.id AND nn.action_status = ${NODE_ACTION.REJECTED}
		ORDER BY nn.action_at DESC LIMIT 1
	)`

	// 新增 / 迭代判定
	const isFirstVersionSql = Prisma.sql`(
		CASE WHEN (
			SELECT COUNT(*) FROM doc_document_versions vc
			WHERE vc.document_id = inst.document_id AND vc.id < inst.biz_id AND vc.deleted_at IS NULL
		) = 0 THEN 1 ELSE 0 END
	)`

	const rows = await prisma.$queryRaw<Row[]>`
		SELECT
			inst.id                AS instance_id,
			inst.status            AS status,
			inst.document_id       AS document_id,
			d.title                AS title,
			d.ext                  AS ext,
			inst.biz_id            AS biz_id,
			v.version_no           AS version_no,
			d.group_id             AS group_id,
			g.name                 AS group_name,
			inst.initiator_user_id AS initiator_id,
			u.name                 AS initiator_name,
			inst.created_at        AS submitted_at,
			inst.finished_at       AS finished_at,
			${currentApproverSql}  AS current_approver_name,
			${allApproverSql}      AS all_approver_names,
			${rejectReasonSql}     AS reject_reason,
			${remindCountSql}      AS remind_count,
			${isFirstVersionSql}   AS is_first_version
		FROM doc_approval_instances inst
		JOIN doc_documents            d ON d.id = inst.document_id
		LEFT JOIN doc_document_versions v ON v.id = inst.biz_id
		LEFT JOIN doc_groups           g ON g.id = d.group_id
		LEFT JOIN doc_users            u ON u.id = inst.initiator_user_id
		WHERE inst.document_id = ${docId}
		  AND d.deleted_at IS NULL
		ORDER BY inst.created_at DESC, inst.id DESC
	`

	const list = rows.map((r) => {
		const statusNum = Number(r.status)
		const changeType: ChangeTypeCode = Number(r.is_first_version) === 1 ? CHANGE_TYPE.NEW : CHANGE_TYPE.ITERATE
		return {
			id: Number(r.instance_id),
			status: statusNum,
			documentId: Number(r.document_id),
			title: r.title,
			ext: r.ext ?? '',
			versionId: Number(r.biz_id),
			versionNo: r.version_no ?? '-',
			changeType,
			groupId: r.group_id != null ? Number(r.group_id) : null,
			groupName: r.group_name ?? '-',
			initiatorId: Number(r.initiator_id),
			initiatorName: r.initiator_name ?? '未知用户',
			submittedAt: new Date(r.submitted_at).getTime(),
			handledAt: r.finished_at ? new Date(r.finished_at).getTime() : null,
			currentApproverName:
				statusNum === APPROVAL_STATUS.REVIEWING ? (r.current_approver_name ?? null) : null,
			allApproverNames: r.all_approver_names ?? '',
			rejectReason: r.reject_reason ?? null,
			remindCount: Number(r.remind_count ?? 0),
			canWithdraw: false,
		}
	})

	return ok(list)
})
