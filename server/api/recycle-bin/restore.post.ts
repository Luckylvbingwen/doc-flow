/**
 * POST /api/recycle-bin/restore
 * 批量恢复回收站文件（PRD §6.6.2）
 *
 * Body: { ids: number[] }（1-50）
 * 规则：
 *   - 仅当用户对文档有 recycle:restore 权限 + 数据范围内才能恢复
 *   - 恢复后：status=4 已发布，deleted_at_real=NULL，deleted_by_user_id=NULL
 *   - 若原组已被删除（scope deleted_at IS NOT NULL 或组不存在）→ 该项放入 failed
 *   - 其他不在范围内 / 不存在的 id → 该项放入 failed
 *   - 每恢复成功一条写一条 recycle.restore 操作日志
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { recycleBatchBodySchema } from '~/server/schemas/recycle-bin'
import { buildRecycleScopeFilter } from '~/server/utils/recycle-scope'
import { writeLogs } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

interface RestoreCandidate {
	id: bigint
	title: string
	group_id: bigint | null
	group_deleted: number // 1 = 原组不存在或已软删
}

interface FailedItem {
	id: number
	title: string
	reason: string
}

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'recycle:restore')
	if (denied) return denied

	const user = event.context.user!
	const body = await readValidatedBody(event, recycleBatchBodySchema.parse)
	const ids = Array.from(new Set(body.ids))

	const scopeFilter = await buildRecycleScopeFilter(user.id)

	// ── 候选项（筛出范围内 + 回收站状态 + 原组状态）──
	const candidates = await prisma.$queryRaw<RestoreCandidate[]>`
		SELECT
			d.id, d.title, d.group_id,
			CASE
				WHEN d.group_id IS NULL THEN 0
				WHEN g.id IS NULL THEN 1
				WHEN g.deleted_at IS NOT NULL THEN 1
				ELSE 0
			END AS group_deleted
		FROM doc_documents d
		LEFT JOIN doc_groups g ON g.id = d.group_id
		WHERE d.id IN (${Prisma.join(ids)})
		  AND d.status = 6
		  AND d.deleted_at_real IS NOT NULL
		  AND d.deleted_at IS NULL
		  AND ${scopeFilter}
	`

	const candidateMap = new Map<number, RestoreCandidate>(
		candidates.map(c => [Number(c.id), c]),
	)

	const failed: FailedItem[] = []
	const restoreIds: number[] = []

	for (const id of ids) {
		const c = candidateMap.get(id)
		if (!c) {
			failed.push({ id, title: '-', reason: '不存在或无权操作' })
			continue
		}
		if (Number(c.group_deleted) === 1) {
			failed.push({ id, title: c.title, reason: '原组已被删除，无法恢复' })
			continue
		}
		restoreIds.push(id)
	}

	// ── 执行恢复 + 写日志（事务内）──
	if (restoreIds.length > 0) {
		await prisma.$transaction(async (tx) => {
			await tx.doc_documents.updateMany({
				where: { id: { in: restoreIds.map(BigInt) } },
				data: {
					status: 4,
					deleted_at_real: null,
					deleted_by_user_id: null,
					updated_by: BigInt(user.id),
				},
			})
		})
		await writeLogs(restoreIds.map((id) => {
			const c = candidateMap.get(id)!
			return {
				actorUserId: user.id,
				action: LOG_ACTIONS.RECYCLE_RESTORE,
				targetType: 'document',
				targetId: id,
				groupId: c.group_id != null ? Number(c.group_id) : null,
				documentId: id,
				detail: { desc: `恢复文件「${c.title}」` },
			}
		}))
	}

	return ok({
		restoredCount: restoreIds.length,
		restoredIds: restoreIds,
		failed,
	}, `已恢复 ${restoreIds.length} 项${failed.length > 0 ? `，${failed.length} 项失败` : ''}`)
})
