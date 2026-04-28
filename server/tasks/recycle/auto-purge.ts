/**
 * Nitro 定时任务: recycle:auto-purge
 *
 * 每天凌晨 3:00 扫描回收站中超过 30 天的文件，自动永久删除。
 *
 * 判定条件：
 *   - status = 6（回收站状态）
 *   - deleted_at IS NULL（尚未被手动永久删除）
 *   - deleted_at_real <= NOW() - INTERVAL 30 DAY
 *
 * 永久删除逻辑与 POST /api/recycle-bin/purge 一致：
 *   - doc_documents.deleted_at = NOW()
 *   - doc_document_versions.deleted_at = NOW()
 *   - 级联硬删收藏 / 置顶
 *   - 每条写操作日志 recycle.auto_purge
 *
 * 设计依据：PRD §6.6.2 "删除30天后自动永久删除，不可恢复"
 */
import { prisma } from '~/server/utils/prisma'
import { useLogger } from '~/server/utils/logger'
import { writeLogs } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

interface ExpiredDoc {
	id: bigint
	title: string
	group_id: bigint | null
	deleted_by_user_id: bigint | null
}

const BATCH_SIZE = 200

export default defineTask({
	meta: {
		name: 'recycle:auto-purge',
		description: '回收站 30 天自动永久删除 — 每天凌晨 3:00',
	},
	async run() {
		const logger = useLogger('task:recycle-auto-purge')
		logger.info('recycle:auto-purge 开始执行')

		let totalPurged = 0

		// 分批处理，避免一次性加载过多数据
		 
		while (true) {
			const expired = await prisma.$queryRaw<ExpiredDoc[]>`
				SELECT id, title, group_id, deleted_by_user_id
				FROM doc_documents
				WHERE status = 6
				  AND deleted_at IS NULL
				  AND deleted_at_real IS NOT NULL
				  AND deleted_at_real <= NOW() - INTERVAL 30 DAY
				LIMIT ${BATCH_SIZE}
			`

			if (expired.length === 0) break

			const ids = expired.map(d => d.id)
			const now = new Date()

			await prisma.$transaction(async (tx) => {
				await tx.doc_documents.updateMany({
					where: { id: { in: ids } },
					data: { deleted_at: now },
				})
				await tx.doc_document_versions.updateMany({
					where: { document_id: { in: ids } },
					data: { deleted_at: now },
				})
				await tx.doc_document_favorites.deleteMany({
					where: { document_id: { in: ids } },
				})
				await tx.doc_document_pins.deleteMany({
					where: { document_id: { in: ids } },
				})
			})

			await writeLogs(expired.map(d => ({
				actorUserId: 0,
				action: LOG_ACTIONS.RECYCLE_AUTO_PURGE,
				targetType: 'document' as const,
				targetId: Number(d.id),
				groupId: d.group_id != null ? Number(d.group_id) : null,
				documentId: Number(d.id),
				detail: {
					desc: `系统自动永久删除文件「${d.title}」（回收站超 30 天）`,
					triggeredBy: 'cron.recycle-auto-purge',
				},
			})))

			totalPurged += expired.length
			logger.info({ batch: expired.length, total: totalPurged }, '已清理一批过期文件')

			if (expired.length < BATCH_SIZE) break
		}

		const summary = { purged: totalPurged }
		logger.info(summary, 'recycle:auto-purge 完成')
		return { result: summary }
	},
})
