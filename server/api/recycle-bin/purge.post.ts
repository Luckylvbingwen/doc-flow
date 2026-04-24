/**
 * POST /api/recycle-bin/purge
 * 批量永久删除回收站文件（PRD §6.6.2 "永久删除不可恢复"）
 *
 * Body: { ids: number[] }（1-50）
 * 规则：
 *   - 仅当用户对文档有 recycle:delete 权限 + 数据范围内才能永删
 *   - "永久删除"实现为全局软删（doc_documents.deleted_at + 所有 versions.deleted_at）
 *   - 不在范围 / 不存在 / 已永久删除的 id → failed
 *   - 每永删成功一条写一条 recycle.purge 操作日志
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { recycleBatchBodySchema } from '~/server/schemas/recycle-bin'
import { buildRecycleScopeFilter } from '~/server/utils/recycle-scope'
import { writeLogs } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

interface PurgeCandidate {
	id: bigint
	title: string
	group_id: bigint | null
}

interface FailedItem {
	id: number
	title: string
	reason: string
}

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'recycle:delete')
	if (denied) return denied

	const user = event.context.user!
	const body = await readValidatedBody(event, recycleBatchBodySchema.parse)
	const ids = Array.from(new Set(body.ids))

	const scopeFilter = await buildRecycleScopeFilter(user.id)

	const candidates = await prisma.$queryRaw<PurgeCandidate[]>`
		SELECT d.id, d.title, d.group_id
		FROM doc_documents d
		WHERE d.id IN (${Prisma.join(ids)})
		  AND d.status = 6
		  AND d.deleted_at_real IS NOT NULL
		  AND d.deleted_at IS NULL
		  AND ${scopeFilter}
	`

	const candidateMap = new Map<number, PurgeCandidate>(
		candidates.map(c => [Number(c.id), c]),
	)

	const failed: FailedItem[] = []
	const purgeIds: number[] = []
	for (const id of ids) {
		const c = candidateMap.get(id)
		if (!c) {
			failed.push({ id, title: '-', reason: '不存在、已被永久删除或无权操作' })
			continue
		}
		purgeIds.push(id)
	}

	if (purgeIds.length > 0) {
		const now = new Date()
		const purgeBigIds = purgeIds.map(BigInt)
		await prisma.$transaction(async (tx) => {
			// 文档 + 所有版本标记 deleted_at
			await tx.doc_documents.updateMany({
				where: { id: { in: purgeBigIds } },
				data: { deleted_at: now, updated_by: BigInt(user.id) },
			})
			await tx.doc_document_versions.updateMany({
				where: { document_id: { in: purgeBigIds } },
				data: { deleted_at: now },
			})
			// 级联清理收藏 / 置顶（这两张表无 deleted_at 列，硬删以防孤儿记录）
			await tx.doc_document_favorites.deleteMany({
				where: { document_id: { in: purgeBigIds } },
			})
			await tx.doc_document_pins.deleteMany({
				where: { document_id: { in: purgeBigIds } },
			})
		})
		await writeLogs(purgeIds.map((id) => {
			const c = candidateMap.get(id)!
			return {
				actorUserId: user.id,
				action: LOG_ACTIONS.RECYCLE_PURGE,
				targetType: 'document',
				targetId: id,
				groupId: c.group_id != null ? Number(c.group_id) : null,
				documentId: id,
				detail: { desc: `永久删除文件「${c.title}」` },
			}
		}))
	}

	return ok({
		purgedCount: purgeIds.length,
		purgedIds: purgeIds,
		failed,
	}, `已永久删除 ${purgeIds.length} 项${failed.length > 0 ? `，${failed.length} 项失败` : ''}`)
})
