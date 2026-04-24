/**
 * Nitro 定时任务: approval:remind-timeout
 *
 * 每小时扫描 reviewing 审批实例的当前 pending 节点，按节点级 24h 超时判定：
 *   - remind_count < max    → 发 M5 给当前审批人, remind_count++, 写 approval.remind 日志
 *   - remind_count === max  → 发 M6 给提交人, remind_count++ (哨兵), 写 approval.remind_limit 日志
 *   - remind_count >  max   → 已发过 M6，SQL WHERE 已过滤
 *
 * 节点超时起算：
 *   - node_order = 1     → inst.started_at
 *   - node_order = N>1   → 同实例 node_order=N-1 节点的 action_at
 *
 * 节奏：自 <node_start> 起过 timeout_hours 发首次；此后每过 timeout_hours 再发一次。
 * 通用判定：COALESCE(last_reminded_at, <node_start>) + timeout_hours <= NOW()。
 *
 * 设计依据：docs/superpowers/specs/2026-04-24-approval-timeout-reminder-design.md
 */
import { prisma } from '~/server/utils/prisma'
import { useLogger } from '~/server/utils/logger'
import { getSystemConfigNumber } from '~/server/utils/system-config'
import { createNotification } from '~/server/utils/notify'
import { writeLog } from '~/server/utils/operation-log'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

interface OverdueRow {
	node_id:           bigint
	instance_id:       bigint
	node_order:        number
	approver_user_id:  bigint
	remind_count:      number
	last_reminded_at:  Date | null
	initiator_user_id: bigint
	started_at:        Date
	document_id:       bigint
	title:             string
	group_id:          bigint | null
	timeout_hours:     number | null
	prev_action_at:    Date | null
}

export default defineTask({
	meta: {
		name: 'approval:remind-timeout',
		description: '审批超时催办扫描（M5/M6）— 每整点运行',
	},
	async run() {
		const logger = useLogger('task:approval-remind')
		logger.info('approval:remind-timeout 开始执行')

		const maxRemind = await getSystemConfigNumber('remind_max_count', 3)

		// 扫描所有超时 pending 节点（WHERE 已过滤掉哨兵态 remind_count > maxRemind）
		const rows = await prisma.$queryRaw<OverdueRow[]>`
			SELECT
				n.id                AS node_id,
				n.instance_id       AS instance_id,
				n.node_order        AS node_order,
				n.approver_user_id  AS approver_user_id,
				n.remind_count      AS remind_count,
				n.last_reminded_at  AS last_reminded_at,
				i.initiator_user_id AS initiator_user_id,
				i.started_at        AS started_at,
				i.document_id       AS document_id,
				d.title             AS title,
				d.group_id          AS group_id,
				t.timeout_hours     AS timeout_hours,
				prev.action_at      AS prev_action_at
			FROM doc_approval_instance_nodes n
			JOIN doc_approval_instances      i ON i.id = n.instance_id
			JOIN doc_documents               d ON d.id = i.document_id
			LEFT JOIN doc_approval_templates t ON t.id = i.template_id
			LEFT JOIN doc_approval_instance_nodes prev
			       ON prev.instance_id = n.instance_id
			      AND prev.node_order  = n.node_order - 1
			WHERE i.status        = 2
			  AND n.node_order    = i.current_node_order
			  AND n.action_status = 1
			  AND d.deleted_at    IS NULL
			  AND n.remind_count  <= ${maxRemind}
			  AND COALESCE(n.last_reminded_at,
			               IF(n.node_order = 1, i.started_at, prev.action_at))
			      <= NOW(3) - INTERVAL COALESCE(t.timeout_hours, 24) HOUR
		`

		let m5Count = 0
		let m6Count = 0
		let skipCount = 0

		for (const row of rows) {
			const remindCount = Number(row.remind_count)
			const nodeStart = row.node_order === 1 ? row.started_at : row.prev_action_at
			if (!nodeStart) {
				logger.warn({ nodeId: row.node_id.toString(), nodeOrder: row.node_order }, '节点起算时间无法解析，跳过')
				skipCount++
				continue
			}
			const overdueHours = Math.max(1, Math.floor((Date.now() - nodeStart.getTime()) / 3_600_000))
			const title = row.title ?? ''
			const groupIdNum = row.group_id != null ? Number(row.group_id) : null
			const documentIdNum = Number(row.document_id)
			const instanceIdNum = Number(row.instance_id)

			try {
				if (remindCount < maxRemind) {
					const nextCount = remindCount + 1

					// 乐观锁：只更新 remind_count 仍等于旧值的行，并发下重复扫描静默跳过
					const updated = await prisma.doc_approval_instance_nodes.updateMany({
						where: { id: row.node_id, remind_count: remindCount },
						data:  { remind_count: nextCount, last_reminded_at: new Date() },
					})
					if (updated.count !== 1) {
						skipCount++
						continue
					}

					await createNotification(NOTIFICATION_TEMPLATES.M5.build({
						toUserId:     row.approver_user_id,
						fileName:     title,
						fileId:       row.document_id,
						overdueHours,
					}))
					await writeLog({
						actorUserId: 0,
						action:      LOG_ACTIONS.APPROVAL_REMIND,
						targetType:  'approval',
						targetId:    instanceIdNum,
						groupId:     groupIdNum,
						documentId:  documentIdNum,
						detail: {
							desc:         `系统催办审批「${title}」第 ${row.node_order} 级（第 ${nextCount}/${maxRemind} 次）`,
							nodeOrder:    row.node_order,
							remindCount:  nextCount,
							overdueHours,
							triggeredBy:  'cron.approval-remind-timeout',
						},
					})
					m5Count++
				} else {
					// remindCount === maxRemind — 达上限，发 M6 给提交人并 bump 到哨兵
					const nextCount = remindCount + 1

					const updated = await prisma.doc_approval_instance_nodes.updateMany({
						where: { id: row.node_id, remind_count: remindCount },
						data:  { remind_count: nextCount, last_reminded_at: new Date() },
					})
					if (updated.count !== 1) {
						skipCount++
						continue
					}

					await createNotification(NOTIFICATION_TEMPLATES.M6.build({
						toUserId: row.initiator_user_id,
						fileName: title,
						fileId:   row.document_id,
						maxTimes: maxRemind,
					}))
					await writeLog({
						actorUserId: 0,
						action:      LOG_ACTIONS.APPROVAL_REMIND_LIMIT,
						targetType:  'approval',
						targetId:    instanceIdNum,
						groupId:     groupIdNum,
						documentId:  documentIdNum,
						detail: {
							desc:        `审批「${title}」第 ${row.node_order} 级催办达上限（${maxRemind} 次），通知提交人`,
							nodeOrder:   row.node_order,
							maxTimes:    maxRemind,
							triggeredBy: 'cron.approval-remind-timeout',
						},
					})
					m6Count++
				}
			} catch (err) {
				logger.warn({ err, nodeId: row.node_id.toString() }, '单节点催办失败，跳过')
				skipCount++
			}
		}

		const summary = { scanned: rows.length, m5: m5Count, m6: m6Count, skipped: skipCount }
		logger.info(summary, 'approval:remind-timeout 完成')
		return { result: summary }
	},
})
