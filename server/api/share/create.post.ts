/**
 * POST /api/share/create
 * 创建分享链接（PRD §6.3.8）
 *
 * Body: { documentId: number, permission: 2 | 4 }
 * 规则：
 *   - 文档必须存在且未删除
 *   - 分享权限不能超过分享人自身权限级别
 *   - 如果已存在同文档+同创建者+同权限的链接，复用（幂等）
 *   - 生成 32 字符随机 token
 *   - 不发通知（通知在接收方打开链接时触发，或由前端在弹窗中指定用户时触发）
 */
import { randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { createShareSchema } from '~/server/schemas/share'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { generateId } from '~/server/utils/snowflake'
import {
	DOCUMENT_NOT_FOUND,
	SHARE_PERMISSION_EXCEEDED,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const body = await readValidatedBody(event, createShareSchema.parse)

	// 验证文档存在
	const doc = await prisma.doc_documents.findFirst({
		where: { id: BigInt(body.documentId), deleted_at: null },
		select: { id: true, title: true, group_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	// 校验权限不越级（简化：有 doc:edit 权限可分享编辑权，否则只能分享阅读权）
	if (body.permission === 2) {
		const roles = await prisma.$queryRaw<Array<{ code: string }>>`
			SELECT DISTINCT r.code FROM sys_user_roles ur
			JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
			WHERE ur.user_id = ${user.id}
		`
		const perms = await prisma.$queryRaw<Array<{ code: string }>>`
			SELECT DISTINCT p.code FROM sys_user_roles ur
			JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
			JOIN sys_role_permissions rp ON rp.role_id = r.id
			JOIN sys_permissions p ON p.id = rp.permission_id AND p.deleted_at IS NULL
			WHERE ur.user_id = ${user.id}
		`
		const isSuperAdmin = roles.some(r => r.code === 'super_admin')
		const hasEditPerm = perms.some(p => p.code === 'doc:edit')
		if (!isSuperAdmin && !hasEditPerm) {
			return fail(event, 403, SHARE_PERMISSION_EXCEEDED, '您无编辑权限，只能分享可阅读权限')
		}
	}

	// 幂等：已存在相同链接则复用
	const existing = await prisma.doc_share_links.findFirst({
		where: {
			document_id: doc.id,
			created_by: BigInt(user.id),
			permission: body.permission,
		},
		select: { token: true },
	})
	if (existing) {
		return ok({
			token: existing.token,
			url: `/share/view/${existing.token}`,
		}, '分享链接已就绪')
	}

	// 生成 token
	const token = randomBytes(16).toString('hex')
	const linkId = generateId()

	await prisma.doc_share_links.create({
		data: {
			id: linkId,
			document_id: doc.id,
			token,
			permission: body.permission,
			created_by: BigInt(user.id),
		},
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.SHARE_CREATE,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: doc.group_id != null ? Number(doc.group_id) : null,
		documentId: Number(doc.id),
		detail: {
			desc: `创建文件「${doc.title}」的分享链接（${body.permission === 2 ? '可编辑' : '可阅读'}）`,
			permission: body.permission,
		},
	})

	return ok({
		token,
		url: `/share/view/${token}`,
	}, '分享链接已创建')
})
