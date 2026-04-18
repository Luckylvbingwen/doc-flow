/**
 * GET /api/approvals
 * 审批中心列表（PRD §6.4）
 *
 * Query 见 server/schemas/approval.ts
 *   - tab=pending    待我审批：node.approver=self AND node.action_status=1 AND inst.status=2
 *   - tab=submitted  我发起的：inst.initiator=self
 *   - tab=handled    我已处理：node.approver=self AND node.action_status IN (2,3)
 *   - status         对 submitted / handled 生效，对 pending 无意义（pending 恒为 status=2）
 *
 * 鉴权：登录即可，不挂 requirePermission —— 所有员工都可能是审批人或发起人
 *
 * 返回字段：PRD §6.4.2 三个 Tab 的列表项合集
 *   - documentId / title / ext
 *   - versionId / versionNo
 *   - changeType: 'new' | 'iterate'（COUNT(versions WHERE document_id AND id < biz_id) = 0 → new）
 *   - groupId / groupName
 *   - initiatorId / initiatorName
 *   - status
 *   - submittedAt（inst.created_at；pending/submitted 用）
 *   - handledAt（node.action_at；handled 用）
 *   - currentApproverName（pending / submitted reviewing：当前待我审批人 node）
 *   - allApproverNames（submitted：所有审批人）
 *   - rejectReason（submitted 的 rejected 状态 / handled 的 rejected 记录）
 *   - remindCount（催办次数，取当前节点）
 *   - canWithdraw（仅 submitted tab 且 status=2 的发起人）
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { approvalListQuerySchema } from '~/server/schemas/approval'
import {
	APPROVAL_STATUS,
	NODE_ACTION,
	CHANGE_TYPE,
	type ChangeTypeCode,
} from '~/server/constants/approval'
import { AUTH_REQUIRED } from '~/server/constants/error-codes'

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
	/** tab=handled 时：当前用户作为审批人的处理时间 */
	handled_at: Date | null
	/** pending / submitted reviewing：当前待审批人姓名 */
	current_approver_name: string | null
	/** submitted：所有审批人逗号拼接 */
	all_approver_names: string | null
	/** submitted：最后一条驳回 comment；handled：自己那条 node 的 comment */
	reject_reason: string | null
	/** 当前节点催办次数 */
	remind_count: number | null
	/** 是否首版本 */
	is_first_version: number
}

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const { tab, status, page, pageSize } = await getValidatedQuery(event, approvalListQuerySchema.parse)
	const offset = (page - 1) * pageSize
	const userId = user.id

	// ── 根据 tab 构造主 JOIN / WHERE ──
	// 统一 SELECT 列字段，不同 tab 的差异放在：
	//   1. 主 FROM / JOIN（pending/handled 以 node 为主，submitted 以 instance 为主）
	//   2. WHERE 过滤
	//   3. handled_at 取值
	let whereSql: Prisma.Sql
	let fromSql: Prisma.Sql
	let handledAtSql: Prisma.Sql
	let rejectReasonSql: Prisma.Sql

	if (tab === 'pending') {
		// 待我审批：node 为主
		fromSql = Prisma.sql`
			FROM doc_approval_instance_nodes n
			JOIN doc_approval_instances  inst ON inst.id = n.instance_id
			JOIN doc_documents            d   ON d.id = inst.document_id
			LEFT JOIN doc_document_versions v  ON v.id = inst.biz_id
			LEFT JOIN doc_groups          g   ON g.id = d.group_id
			LEFT JOIN doc_users           u   ON u.id = inst.initiator_user_id
		`
		whereSql = Prisma.sql`
			n.approver_user_id = ${userId}
			AND n.action_status = ${NODE_ACTION.PENDING}
			AND inst.status = ${APPROVAL_STATUS.REVIEWING}
			AND inst.current_node_order = n.node_order
			AND d.deleted_at IS NULL
		`
		handledAtSql = Prisma.sql`NULL`
		rejectReasonSql = Prisma.sql`NULL`
	} else if (tab === 'submitted') {
		// 我发起的：instance 为主
		fromSql = Prisma.sql`
			FROM doc_approval_instances  inst
			JOIN doc_documents            d  ON d.id = inst.document_id
			LEFT JOIN doc_document_versions v ON v.id = inst.biz_id
			LEFT JOIN doc_groups          g  ON g.id = d.group_id
			LEFT JOIN doc_users           u  ON u.id = inst.initiator_user_id
			LEFT JOIN doc_approval_instance_nodes n
				ON n.instance_id = inst.id AND n.node_order = inst.current_node_order
		`
		const baseWhere = Prisma.sql`
			inst.initiator_user_id = ${userId}
			AND d.deleted_at IS NULL
		`
		whereSql = status != null
			? Prisma.sql`${baseWhere} AND inst.status = ${status}`
			: baseWhere
		handledAtSql = Prisma.sql`inst.finished_at`
		// 最后一条驳回 comment
		rejectReasonSql = Prisma.sql`(
			SELECT nn.action_comment
			FROM doc_approval_instance_nodes nn
			WHERE nn.instance_id = inst.id AND nn.action_status = ${NODE_ACTION.REJECTED}
			ORDER BY nn.action_at DESC LIMIT 1
		)`
	} else {
		// handled：node 为主，限我处理过的（通过或驳回）
		fromSql = Prisma.sql`
			FROM doc_approval_instance_nodes n
			JOIN doc_approval_instances  inst ON inst.id = n.instance_id
			JOIN doc_documents            d   ON d.id = inst.document_id
			LEFT JOIN doc_document_versions v  ON v.id = inst.biz_id
			LEFT JOIN doc_groups          g   ON g.id = d.group_id
			LEFT JOIN doc_users           u   ON u.id = inst.initiator_user_id
		`
		const baseWhere = Prisma.sql`
			n.approver_user_id = ${userId}
			AND n.action_status IN (${NODE_ACTION.APPROVED}, ${NODE_ACTION.REJECTED})
			AND d.deleted_at IS NULL
		`
		whereSql = status != null
			? Prisma.sql`${baseWhere} AND inst.status = ${status}`
			: baseWhere
		handledAtSql = Prisma.sql`n.action_at`
		rejectReasonSql = Prisma.sql`n.action_comment`
	}

	// 排序列：pending/submitted 用 inst.created_at DESC；handled 用自己的 action_at DESC
	const orderSql = tab === 'handled'
		? Prisma.sql`ORDER BY n.action_at DESC, inst.id DESC`
		: Prisma.sql`ORDER BY inst.created_at DESC, inst.id DESC`

	// 当前节点待审批人姓名
	const currentApproverSql = Prisma.sql`(
		SELECT cu.name FROM doc_approval_instance_nodes nn
		JOIN doc_users cu ON cu.id = nn.approver_user_id
		WHERE nn.instance_id = inst.id AND nn.node_order = inst.current_node_order
		LIMIT 1
	)`

	// 所有审批人姓名拼接
	const allApproverSql = Prisma.sql`(
		SELECT GROUP_CONCAT(au.name ORDER BY nn.node_order SEPARATOR ',')
		FROM doc_approval_instance_nodes nn
		JOIN doc_users au ON au.id = nn.approver_user_id
		WHERE nn.instance_id = inst.id
	)`

	// 当前节点催办次数
	const remindCountSql = Prisma.sql`(
		SELECT nn.remind_count FROM doc_approval_instance_nodes nn
		WHERE nn.instance_id = inst.id AND nn.node_order = inst.current_node_order
		LIMIT 1
	)`

	// 新增/迭代判定
	const isFirstVersionSql = Prisma.sql`(
		CASE WHEN (
			SELECT COUNT(*) FROM doc_document_versions vc
			WHERE vc.document_id = inst.document_id AND vc.id < inst.biz_id AND vc.deleted_at IS NULL
		) = 0 THEN 1 ELSE 0 END
	)`

	// ── 总数 ──
	const countRows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
		SELECT COUNT(*) AS cnt ${fromSql} WHERE ${whereSql}
	`
	const total = Number(countRows[0]?.cnt ?? 0)

	// ── 列表 ──
	const rows = await prisma.$queryRaw<Row[]>`
		SELECT
			inst.id                          AS instance_id,
			inst.status                      AS status,
			inst.document_id                 AS document_id,
			d.title                          AS title,
			d.ext                            AS ext,
			inst.biz_id                      AS biz_id,
			v.version_no                     AS version_no,
			d.group_id                       AS group_id,
			g.name                           AS group_name,
			inst.initiator_user_id           AS initiator_id,
			u.name                           AS initiator_name,
			inst.created_at                  AS submitted_at,
			${handledAtSql}                  AS handled_at,
			${currentApproverSql}            AS current_approver_name,
			${allApproverSql}                AS all_approver_names,
			${rejectReasonSql}               AS reject_reason,
			${remindCountSql}                AS remind_count,
			${isFirstVersionSql}             AS is_first_version
		${fromSql}
		WHERE ${whereSql}
		${orderSql}
		LIMIT ${pageSize} OFFSET ${offset}
	`

	const list = rows.map((r) => {
		const statusNum = Number(r.status)
		const changeType: ChangeTypeCode = Number(r.is_first_version) === 1 ? CHANGE_TYPE.NEW : CHANGE_TYPE.ITERATE
		return {
			id:                  Number(r.instance_id),
			status:              statusNum,
			documentId:          Number(r.document_id),
			title:               r.title,
			ext:                 r.ext ?? '',
			versionId:           Number(r.biz_id),
			versionNo:           r.version_no ?? '-',
			changeType,
			groupId:             r.group_id != null ? Number(r.group_id) : null,
			groupName:           r.group_name ?? '-',
			initiatorId:         Number(r.initiator_id),
			initiatorName:       r.initiator_name ?? '未知用户',
			submittedAt:         new Date(r.submitted_at).getTime(),
			handledAt:           r.handled_at ? new Date(r.handled_at).getTime() : null,
			currentApproverName: r.current_approver_name ?? null,
			allApproverNames:    r.all_approver_names ?? '',
			rejectReason:        r.reject_reason ?? null,
			remindCount:         Number(r.remind_count ?? 0),
			canWithdraw:         tab === 'submitted' && statusNum === APPROVAL_STATUS.REVIEWING,
		}
	})

	return ok({ list, total, page, pageSize })
})
