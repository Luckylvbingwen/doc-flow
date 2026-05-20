/**
 * Nitro task: cross-move:expire-moves
 * 每天扫描过期的跨组移动请求，自动关闭并通知发起人（PRD §6.3.6 "长时间未响应"）
 *
 * 触发条件：status=1 且 created_at < NOW() - 3天
 * 动作：status → 4(过期)，发 M13 给发起人，写 doc.move.expire 日志
 */
import { prisma } from '~/server/utils/prisma'
import { createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { writeLogs } from '~/server/utils/operation-log'

export default defineTask({
	meta: {
		name: 'cross-move:expire-moves',
		description: '扫描过期的跨组移动请求并自动关闭',
	},
	async run() {
		const EXPIRE_DAYS = 3
		const expireThreshold = new Date(Date.now() - EXPIRE_DAYS * 24 * 60 * 60 * 1000)

		// 查所有过期但仍 pending 的记录
		const expired = await prisma.doc_cross_group_moves.findMany({
			where: { status: 1, created_at: { lt: expireThreshold } },
			include: {
				doc_documents: { select: { id: true, title: true } },
			},
		})

		if (expired.length === 0) return { result: { expired: 0 } }

		// 批量更新状态
		const ids = expired.map(t => t.id)
		await prisma.doc_cross_group_moves.updateMany({
			where: { id: { in: ids } },
			data: { status: 4, updated_at: new Date() },
		})

		// 批量通知发起人（M13 已过期）
		const notifications = expired.map(t =>
			NOTIFICATION_TEMPLATES.M13.build({
				toUserId: Number(t.initiated_by),
				fileName: t.doc_documents?.title ?? '未知文档',
				result: '已过期',
			}),
		)
		await createNotifications(notifications)

		// 操作日志（actor_user_id=0 系统触发）
		await writeLogs(
			expired.map(t => ({
				actorUserId: 0,
				action: LOG_ACTIONS.DOC_MOVE_EXPIRE,
				targetType: 'document' as const,
				targetId: Number(t.document_id),
				groupId: Number(t.source_group_id),
				documentId: Number(t.document_id),
				detail: {
					desc: `跨组移动请求超时自动过期`,
					moveId: t.id.toString(),
					targetGroupId: Number(t.target_group_id),
				},
			})),
		)

		console.log(`[task:cross-move:expire-moves] 已过期 ${expired.length} 条跨组移动请求`)
		return { result: { expired: expired.length } }
	},
})
