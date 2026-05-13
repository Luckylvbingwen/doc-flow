/**
 * GET /api/documents/:id/snapshots/:sid/preview
 * 渲染快照 Markdown 为 HTML 预览
 *
 * 权限：归属人 或 有编辑权限（permission <= 2）
 */
import { prisma } from '~/server/utils/prisma'
import { storage } from '~/server/utils/storage/index'
import { renderMarkdown } from '~/server/utils/markdown'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	PERMISSION_DENIED,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const sidStr = getRouterParam(event, 'sid')
	if (!sidStr || !/^\d+$/.test(sidStr)) {
		return fail(event, 400, INVALID_PARAMS, '快照 ID 非法')
	}
	const docId = BigInt(idStr)
	const snapId = BigInt(sidStr)

	// 校验文档存在
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, owner_user_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	// 权限：归属人 或 有编辑权限（permission <= 2）
	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) return fail(event, 403, PERMISSION_DENIED, '无权访问此文档的快照')
	}

	// 查询快照记录
	const snap = await prisma.doc_document_snapshots.findFirst({
		where: { id: snapId, document_id: docId },
		select: { storage_key: true, name: true },
	})
	if (!snap) return fail(event, 404, INVALID_PARAMS, '快照不存在')

	// 从对象存储读取内容并渲染
	const buffer = await storage.getObject(snap.storage_key)
	const content = buffer.toString('utf-8')
	const html = renderMarkdown(content)

	return ok({
		html,
		name: snap.name,
	})
})
