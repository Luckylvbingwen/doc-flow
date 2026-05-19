/**
 * POST /api/documents/:id/edit-copy
 * 为已发布文档创建编辑副本（PRD §6.3.5 编辑副本机制）
 * - 一文档只有一份活跃副本；若已存在则直接返回其 ID
 * - 从当前版本 MinIO 文件加载初始内容
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { storage } from '~/server/utils/storage'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { DOCUMENT_NOT_FOUND, DOCUMENT_STATUS_INVALID, PERMISSION_DENIED, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, status: true, owner_user_id: true, current_version_id: true, group_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.status !== 4) return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅已发布文档可创建编辑副本')

	// 权限：归属人 或 可编辑成员（permission <= 2）
	// PRD §4.3：role=3（上传下载）仅可编辑自己上传的文件
	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		// 组内角色检查：role=3 不可编辑他人文档
		if (doc.group_id) {
			const member = await prisma.doc_group_members.findFirst({
				where: { group_id: doc.group_id, user_id: BigInt(user.id), deleted_at: null },
				select: { role: true },
			})
			if (member && member.role === 3) {
				return fail(event, 403, PERMISSION_DENIED, '上传下载角色仅可编辑自己上传的文件')
			}
		}
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) return fail(event, 403, PERMISSION_DENIED, '无编辑权限')
	}

	// 统计当前版本未解决批注数
	const unresolvedAnnotationCount = await prisma.doc_document_annotations.count({
		where: {
			document_id: docId,
			status: 1, // open
			deleted_at: null,
		},
	})

	// 检查是否已有活跃副本
	const existing = await prisma.doc_documents.findFirst({
		where: { source_doc_id: docId, status: { in: [1, 2] }, deleted_at: null },
		select: { id: true, owner_user_id: true },
	})
	if (existing) {
		const isOwnCopy = Number(existing.owner_user_id) === user.id
		let ownerName = ''
		if (!isOwnCopy) {
			const ownerUser = await prisma.doc_users.findFirst({
				where: { id: existing.owner_user_id },
				select: { name: true },
			})
			ownerName = ownerUser?.name ?? '未知用户'
		}
		return ok({
			id: existing.id.toString(),
			isNew: false,
			ownerUserId: Number(existing.owner_user_id),
			ownerName,
			unresolvedAnnotationCount,
		}, '已有活跃编辑副本')
	}

	// 加载原文档当前版本内容（MinIO）
	let initialContent = ''
	if (doc.current_version_id) {
		const version = await prisma.doc_document_versions.findFirst({
			where: { id: doc.current_version_id, deleted_at: null },
			select: { storage_key: true },
		})
		if (version?.storage_key) {
			try {
				const buf = await storage.getObject(version.storage_key)
				initialContent = buf.toString('utf-8')
			} catch {
				// 加载失败时以空内容创建副本，不阻断流程
			}
		}
	}

	const copyId = generateId()
	await prisma.doc_documents.create({
		data: {
			id: BigInt(copyId),
			source_doc_id: docId,
			owner_user_id: BigInt(user.id),
			created_by: BigInt(user.id),
			title: doc.title,
			ext: 'md',
			doc_type: 2,
			status: 2,  // 编辑中
			group_id: doc.group_id,
			draft_content: initialContent,
		},
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_DRAFT_CREATE,
		targetType: 'document',
		targetId: Number(docId),
		groupId: doc.group_id ? Number(doc.group_id) : undefined,
		documentId: Number(docId),
		detail: { desc: `创建编辑副本「${doc.title}」`, copyId: copyId.toString() },
	})

	return ok({ id: copyId.toString(), isNew: true, unresolvedAnnotationCount }, '编辑副本已创建')
})
