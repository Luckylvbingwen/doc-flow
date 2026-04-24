/**
 * PUT /api/documents/:id/remove
 * 从组移除文档（PRD §5.1 / §6.3.4）
 *
 * 业务：
 *   1. 权限 doc:remove
 *   2. 文档必须 status=4 已发布
 *   3. 操作人必须是组管理员（role=1）/ 组负责人 / super_admin
 *   4. UPDATE status=1 草稿（保留 group_id / current_version_id，退回归属人个人中心）
 *   5. 写 DOC_REMOVE 日志 + M9 通知归属人
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { writeLog } from '~/server/utils/operation-log'
import { createNotification } from '~/server/utils/notify'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	DOCUMENT_STATUS_INVALID,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:remove')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: {
			id: true,
			title: true,
			status: true,
			group_id: true,
			owner_user_id: true,
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
	if (doc.status !== 4) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅已发布文档可移除')
	}
	if (!doc.group_id || !doc.doc_groups) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '文档未归属任何组，无需移除')
	}

	const group = doc.doc_groups
	const groupErr = await requireMemberPermission(event, {
		groupId:     Number(group.id),
		scopeType:   group.scope_type,
		scopeRefId:  group.scope_ref_id != null ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
	})
	if (groupErr) return groupErr

	await prisma.doc_documents.update({
		where: { id: docId },
		data: {
			status: 1,
			updated_by: BigInt(user.id),
			updated_at: new Date(),
		},
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_REMOVE,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: Number(doc.group_id),
		documentId: Number(doc.id),
		detail: {
			desc: `从组「${group.name}」移除文件「${doc.title}」，已退回归属人个人中心`,
			groupName: group.name,
		},
	})

	// M9 通知归属人（若归属人正是操作人自己，跳过冗余通知）
	if (Number(doc.owner_user_id) !== user.id) {
		await createNotification(NOTIFICATION_TEMPLATES.M9.build({
			toUserId: doc.owner_user_id,
			operator: user.name ?? '',
			fileName: doc.title,
			fileId: doc.id,
			groupName: group.name,
		}))
	}

	return ok({ id: Number(doc.id) }, '已从组移除，文档已退回归属人个人中心')
})
