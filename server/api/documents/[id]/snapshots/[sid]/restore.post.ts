/**
 * POST /api/documents/:id/snapshots/:sid/restore
 * 将快照内容还原到草稿（draft_content）
 *
 * 权限：归属人 或 有编辑权限（permission <= 2）
 */
import { prisma } from '~/server/utils/prisma'
import { storage } from '~/server/utils/storage/index'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	PERMISSION_DENIED,
	DOCUMENT_STATUS_INVALID,
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

	// 1. 校验文档存在、类型为在线编辑文档（doc_type=2）、状态允许操作（草稿=1 或 编辑中=2）
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: {
			id: true,
			doc_type: true,
			status: true,
			owner_user_id: true,
		},
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.doc_type !== 2) return fail(event, 400, INVALID_PARAMS, '该文档不是在线编辑文档')
	if (![1, 2].includes(doc.status)) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '当前文档状态不允许还原快照')
	}

	// 2. 权限：归属人 或 有编辑权限（permission <= 2）
	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) return fail(event, 403, PERMISSION_DENIED, '无权访问此文档的快照')
	}

	// 3. 查询快照记录
	const snap = await prisma.doc_document_snapshots.findFirst({
		where: { id: snapId, document_id: docId },
		select: { storage_key: true },
	})
	if (!snap) return fail(event, 404, INVALID_PARAMS, '快照不存在')

	// 4. 从对象存储读取快照内容
	const buffer = await storage.getObject(snap.storage_key)
	const content = buffer.toString('utf-8')

	// 5. 还原草稿内容
	await prisma.doc_documents.update({
		where: { id: docId },
		data: {
			draft_content: content,
			updated_at: new Date(),
			updated_by: BigInt(user.id),
		},
	})

	return ok(null, '已还原到此快照')
})
