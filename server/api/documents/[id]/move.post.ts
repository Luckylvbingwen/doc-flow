/**
 * POST /api/documents/:id/move
 * 发起跨组移动请求（PRD §6.3.3 / §6.8.2 M12）
 *
 * 规则：
 *   - 文档必须 status=4 已发布，且属于某个组
 *   - 操作人需对源组有管理权限（doc:move 权限码）
 *   - 目标组不能是当前组
 *   - 目标组不能有同名文件
 *   - 若已有待处理的移动请求，拒绝重复发起
 *   - 写入 doc_cross_group_moves，通知目标组负责人（M12），写日志
 */
import { prisma } from '~/server/utils/prisma'
import { crossMoveRequestSchema } from '~/server/schemas/cross-move'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { writeLog } from '~/server/utils/operation-log'
import { createNotification } from '~/server/utils/notify'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { generateId } from '~/server/utils/snowflake'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	DOCUMENT_STATUS_INVALID,
	GROUP_NOT_FOUND,
	DOCUMENT_DUPLICATE_NAME,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:move')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)
	const body = await readValidatedBody(event, crossMoveRequestSchema.parse)

	// 加载文档 + 源组
	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: {
			id: true,
			title: true,
			status: true,
			group_id: true,
			deleted_at: true,
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
	if (!doc || doc.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.status !== 4) return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅已发布文档可移动')
	if (!doc.group_id || !doc.doc_groups) return fail(event, 409, DOCUMENT_STATUS_INVALID, '文档未归属任何组')

	const sourceGroup = doc.doc_groups
	const sourceGroupId = Number(sourceGroup.id)

	// 校验操作人对源组的管理权限
	const groupErr = await requireMemberPermission(event, {
		groupId: sourceGroupId,
		scopeType: sourceGroup.scope_type,
		scopeRefId: sourceGroup.scope_ref_id != null ? Number(sourceGroup.scope_ref_id) : null,
		ownerUserId: Number(sourceGroup.owner_user_id),
	})
	if (groupErr) return groupErr

	// 目标组校验
	if (body.targetGroupId === sourceGroupId) {
		return fail(event, 400, INVALID_PARAMS, '目标组不能与当前组相同')
	}

	const targetGroup = await prisma.doc_groups.findFirst({
		where: { id: BigInt(body.targetGroupId), deleted_at: null },
		select: { id: true, name: true, owner_user_id: true },
	})
	if (!targetGroup) return fail(event, 404, GROUP_NOT_FOUND, '目标组不存在')

	// 同名检测
	const duplicate = await prisma.doc_documents.findFirst({
		where: {
			group_id: targetGroup.id,
			title: doc.title,
			deleted_at: null,
			status: { not: 6 },
		},
		select: { id: true },
	})
	if (duplicate) return fail(event, 409, DOCUMENT_DUPLICATE_NAME, `目标组已存在同名文件「${doc.title}」`)

	// 重复请求检查
	const existing = await prisma.doc_cross_group_moves.findFirst({
		where: {
			document_id: docId,
			status: 1,
		},
		select: { id: true },
	})
	if (existing) return fail(event, 409, 'MOVE_REQUEST_PENDING', '该文档已有待处理的移动请求')

	// 创建移动请求
	const moveId = generateId()
	const now = new Date()
	await prisma.doc_cross_group_moves.create({
		data: {
			id: moveId,
			document_id: docId,
			source_group_id: BigInt(sourceGroupId),
			target_group_id: targetGroup.id,
			status: 1,
			initiated_by: BigInt(user.id),
			created_at: now,
			updated_at: now,
		},
	})

	// 日志
	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_MOVE_REQUEST,
		targetType: 'document',
		targetId: Number(docId),
		groupId: sourceGroupId,
		documentId: Number(docId),
		detail: {
			desc: `发起将文件「${doc.title}」从「${sourceGroup.name}」移动到「${targetGroup.name}」`,
			fromGroup: sourceGroup.name,
			toGroup: targetGroup.name,
			moveId: Number(moveId),
		},
	})

	// M12 通知目标组负责人
	if (targetGroup.owner_user_id) {
		await createNotification(NOTIFICATION_TEMPLATES.M12.build({
			toUserId: targetGroup.owner_user_id,
			initiator: user.name ?? '',
			fileName: doc.title,
			fromGroup: sourceGroup.name,
			toGroup: targetGroup.name,
		}))
	}

	return ok({ moveId: Number(moveId) }, '移动请求已发起，等待目标组负责人确认')
})
