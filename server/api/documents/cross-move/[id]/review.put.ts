/**
 * PUT /api/documents/cross-move/:id/review
 * 审核跨组移动请求（目标组负责人同意/拒绝）
 *
 * Body: { action: 'approve' | 'reject' }
 * 规则：
 *   - 操作人必须是目标组负责人或 super_admin
 *   - 只有 status=1（待确认）的请求可审核
 *   - approve: 执行移动（UPDATE group_id）+ 写日志 + M13 通知发起人
 *   - reject: 标记 status=3 + 写日志 + M13 通知发起人
 */
import { prisma } from '~/server/utils/prisma'
import { crossMoveReviewSchema } from '~/server/schemas/cross-move'
import { writeLog } from '~/server/utils/operation-log'
import { createNotification } from '~/server/utils/notify'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { INVALID_PARAMS, NOT_FOUND, PERMISSION_DENIED } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:move')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '请求 ID 非法')
	}
	const moveId = BigInt(idStr)
	const body = await readValidatedBody(event, crossMoveReviewSchema.parse)

	// 加载移动请求
	const move = await prisma.doc_cross_group_moves.findUnique({
		where: { id: moveId },
		include: {
			doc_documents: { select: { id: true, title: true, status: true, deleted_at: true } },
			doc_groups_doc_cross_group_moves_source_group_idTodoc_groups: { select: { name: true } },
			doc_groups_doc_cross_group_moves_target_group_idTodoc_groups: { select: { id: true, name: true, owner_user_id: true } },
			doc_users: { select: { id: true, name: true } },
		},
	})
	if (!move) return fail(event, 404, NOT_FOUND, '移动请求不存在')
	if (move.status !== 1) return fail(event, 409, 'MOVE_ALREADY_REVIEWED', '该请求已被处理')

	const targetGroup = move.doc_groups_doc_cross_group_moves_target_group_idTodoc_groups!
	const sourceGroupName = move.doc_groups_doc_cross_group_moves_source_group_idTodoc_groups?.name ?? ''
	const doc = move.doc_documents!
	const initiator = move.doc_users!

	// 权限：目标组负责人 或 super_admin
	const isTargetOwner = Number(targetGroup.owner_user_id) === user.id
	const roles = await prisma.$queryRaw<Array<{ code: string }>>`
		SELECT r.code FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ur.user_id = ${user.id}
	`
	const isSuperAdmin = roles.some(r => r.code === 'super_admin')
	if (!isTargetOwner && !isSuperAdmin) {
		return fail(event, 403, PERMISSION_DENIED, '仅目标组负责人可审核此请求')
	}

	const now = new Date()

	if (body.action === 'approve') {
		// 检查文档仍然合法
		if (doc.deleted_at || doc.status !== 4) {
			return fail(event, 409, 'MOVE_DOC_INVALID', '文档已被删除或状态已变更，无法移动')
		}

		// 执行移动
		await prisma.$transaction(async (tx) => {
			await tx.doc_cross_group_moves.update({
				where: { id: moveId },
				data: { status: 2, reviewed_by: BigInt(user.id), reviewed_at: now, updated_at: now },
			})
			await tx.doc_documents.update({
				where: { id: doc.id },
				data: { group_id: targetGroup.id, updated_at: now, updated_by: BigInt(user.id) },
			})
		})

		await writeLog({
			actorUserId: user.id,
			action: LOG_ACTIONS.DOC_MOVE_APPROVE,
			targetType: 'document',
			targetId: Number(doc.id),
			groupId: Number(targetGroup.id),
			documentId: Number(doc.id),
			detail: {
				desc: `同意将文件「${doc.title}」从「${sourceGroupName}」移动到「${targetGroup.name}」`,
				moveId: Number(moveId),
			},
		})

		// M13 通知发起人
		await createNotification(NOTIFICATION_TEMPLATES.M13.build({
			toUserId: initiator.id,
			fileName: doc.title,
			result: '已同意',
		}))

		return ok(null, `已同意，文件「${doc.title}」已移动到「${targetGroup.name}」`)
	} else {
		// reject
		await prisma.doc_cross_group_moves.update({
			where: { id: moveId },
			data: { status: 3, reviewed_by: BigInt(user.id), reviewed_at: now, updated_at: now },
		})

		await writeLog({
			actorUserId: user.id,
			action: LOG_ACTIONS.DOC_MOVE_REJECT,
			targetType: 'document',
			targetId: Number(doc.id),
			groupId: Number(move.source_group_id),
			documentId: Number(doc.id),
			detail: {
				desc: `拒绝将文件「${doc.title}」移动到「${targetGroup.name}」`,
				moveId: Number(moveId),
			},
		})

		await createNotification(NOTIFICATION_TEMPLATES.M13.build({
			toUserId: initiator.id,
			fileName: doc.title,
			result: '已拒绝',
		}))

		return ok(null, '已拒绝移动请求')
	}
})
