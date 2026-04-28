/**
 * GET /api/share/:token
 * 打开分享链接（PRD §6.3.8）
 *
 * 规则：
 *   - 需要登录（组织内部用户）
 *   - 校验 token 有效
 *   - 不降级：如果用户已有更高权限，不覆盖
 *   - 写入/升级 doc_document_permissions
 *   - M17 通知文档创建者（有人通过分享链接访问）
 *   - 返回文档 ID，前端跳转
 */
import { prisma } from '~/server/utils/prisma'
import { createNotification } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { SHARE_NOT_FOUND, DOCUMENT_NOT_FOUND } from '~/server/constants/error-codes'
import { generateId } from '~/server/utils/snowflake'

const PERM_LABELS: Record<number, string> = { 2: '可编辑', 4: '可阅读' }

export default defineEventHandler(async (event) => {
	// 需要登录
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const token = getRouterParam(event, 'token')
	if (!token || !/^[\da-f]{32}$/i.test(token)) {
		return fail(event, 400, SHARE_NOT_FOUND, '链接无效')
	}

	const link = await prisma.doc_share_links.findUnique({
		where: { token },
		select: {
			id: true,
			document_id: true,
			permission: true,
			created_by: true,
			doc_documents: { select: { id: true, title: true, deleted_at: true } },
			doc_users: { select: { name: true } },
		},
	})
	if (!link) return fail(event, 404, SHARE_NOT_FOUND, '分享链接不存在或已失效')
	if (link.doc_documents.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档已被删除')

	const docId = link.document_id
	const userId = BigInt(user.id)
	const linkPermission = link.permission // 2=可编辑, 4=可阅读（数字越小权限越高）

	// 检查是否已有权限
	const existingPerm = await prisma.doc_document_permissions.findFirst({
		where: { document_id: docId, user_id: userId, deleted_at: null },
		select: { id: true, permission: true },
	})

	if (existingPerm) {
		// 不降级：只有分享权限更高（数字更小）时才升级
		if (linkPermission < existingPerm.permission) {
			await prisma.doc_document_permissions.update({
				where: { id: existingPerm.id },
				data: { permission: linkPermission, updated_at: new Date() },
			})
		}
	} else {
		// 新增权限
		await prisma.doc_document_permissions.create({
			data: {
				id: generateId(),
				document_id: docId,
				user_id: userId,
				permission: linkPermission,
				granted_by: userId,
				created_at: new Date(),
				updated_at: new Date(),
			},
		})
	}

	// M17 通知分享者（若访问者不是分享者本人）
	if (Number(link.created_by) !== user.id) {
		await createNotification(NOTIFICATION_TEMPLATES.M17.build({
			toUserId: link.created_by,
			sharer: user.name ?? '',
			fileName: link.doc_documents.title,
			fileId: docId,
			permLabel: PERM_LABELS[linkPermission] || '可阅读',
		}))
	}

	return ok({
		documentId: Number(docId),
		title: link.doc_documents.title,
		permission: linkPermission,
	})
})
