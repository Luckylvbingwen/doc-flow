/**
 * POST /api/documents/batch-remove
 * 批量从组移除文档（PRD §6.3.2 文件列表批量操作）
 *
 * Body: { ids: number[] }（1-50）
 * 规则同单条移除：
 *   - 文档必须 status=4 已发布
 *   - 操作人必须是组管理员/组负责人/super_admin
 *   - 移除后 status=1（退回归属人个人中心）
 *   - 写日志 + 发 M9 通知归属人
 *   - 不在范围/不满足条件的 id → failed
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { writeLogs } from '~/server/utils/operation-log'
import { createNotifications } from '~/server/utils/notify'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { z } from 'zod'

const bodySchema = z.object({
	ids: z.array(z.number().int().positive()).min(1).max(50),
})

interface FailedItem {
	id: number
	reason: string
}

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:remove')
	if (permErr) return permErr
	const user = event.context.user!

	const body = await readValidatedBody(event, bodySchema.parse)
	const ids = Array.from(new Set(body.ids))

	// 加载文档 + 组信息
	const docs = await prisma.doc_documents.findMany({
		where: {
			id: { in: ids.map(BigInt) },
			deleted_at: null,
		},
		select: {
			id: true,
			title: true,
			status: true,
			group_id: true,
			owner_user_id: true,
			doc_groups: {
				select: {
					id: true,
					name: true,
					scope_type: true,
					scope_ref_id: true,
					owner_user_id: true,
				},
			},
		},
	})

	const docMap = new Map(docs.map(d => [Number(d.id), d]))
	const failed: FailedItem[] = []
	const removeIds: number[] = []

	// 检查每条文档的权限（同一组的批量操作只需校验一次组权限）
	const groupPermCache = new Map<number, boolean>()

	for (const id of ids) {
		const doc = docMap.get(id)
		if (!doc) {
			failed.push({ id, reason: '文档不存在' })
			continue
		}
		if (doc.status !== 4) {
			failed.push({ id, reason: '仅已发布文档可移除' })
			continue
		}
		if (!doc.group_id || !doc.doc_groups) {
			failed.push({ id, reason: '文档未归属任何组' })
			continue
		}

		const gid = Number(doc.group_id)
		if (!groupPermCache.has(gid)) {
			const group = doc.doc_groups
			const err = await requireMemberPermission(event, {
				groupId: gid,
				scopeType: group.scope_type,
				scopeRefId: group.scope_ref_id != null ? Number(group.scope_ref_id) : null,
				ownerUserId: Number(group.owner_user_id),
			})
			groupPermCache.set(gid, !err)
		}
		if (!groupPermCache.get(gid)) {
			failed.push({ id, reason: '无权操作该组' })
			continue
		}
		removeIds.push(id)
	}

	if (removeIds.length > 0) {
		await prisma.doc_documents.updateMany({
			where: { id: { in: removeIds.map(BigInt) } },
			data: {
				status: 1,
				updated_by: BigInt(user.id),
				updated_at: new Date(),
			},
		})

		// 批量写日志
		await writeLogs(removeIds.map((id) => {
			const doc = docMap.get(id)!
			return {
				actorUserId: user.id,
				action: LOG_ACTIONS.DOC_REMOVE,
				targetType: 'document' as const,
				targetId: id,
				groupId: doc.group_id != null ? Number(doc.group_id) : null,
				documentId: id,
				detail: {
					desc: `从组「${doc.doc_groups?.name}」批量移除文件「${doc.title}」`,
					groupName: doc.doc_groups?.name,
					batchRemove: true,
				},
			}
		}))

		// M9 通知归属人（去重 + 排除操作人自己）
		const notifications = removeIds
			.map((id) => {
				const doc = docMap.get(id)!
				if (Number(doc.owner_user_id) === user.id) return null
				return NOTIFICATION_TEMPLATES.M9.build({
					toUserId: doc.owner_user_id,
					operator: user.name ?? '',
					fileName: doc.title,
					fileId: doc.id,
					groupName: doc.doc_groups?.name ?? '',
				})
			})
			.filter(Boolean) as any[]

		if (notifications.length > 0) {
			await createNotifications(notifications)
		}
	}

	return ok({
		removedCount: removeIds.length,
		removedIds: removeIds,
		failed,
	}, `已移除 ${removeIds.length} 个文件${failed.length > 0 ? `，${failed.length} 个失败` : ''}`)
})
