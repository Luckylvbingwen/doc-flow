/**
 * POST /api/documents/:id/snapshots
 * 创建命名快照（type=2）
 *
 * body: { name: string }
 *
 * 权限：归属人 或 有编辑权限（permission <= 2）
 */
import { prisma } from '~/server/utils/prisma'
import { storage } from '~/server/utils/storage/index'
import { generateId } from '~/server/utils/snowflake'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { z } from 'zod'
import crypto from 'node:crypto'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	PERMISSION_DENIED,
	DOCUMENT_STATUS_INVALID,
} from '~/server/constants/error-codes'

const createSnapshotSchema = z.object({
	name: z.string().min(1).max(100).trim(),
})

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	const body = await readValidatedBody(event, createSnapshotSchema.parse)

	// 1. 校验文档存在、类型为在线编辑文档（doc_type=2）、状态允许操作（草稿=1 或 编辑中=2）
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: {
			id: true,
			doc_type: true,
			status: true,
			draft_content: true,
			owner_user_id: true,
		},
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.doc_type !== 2) return fail(event, 400, INVALID_PARAMS, '该文档不是在线编辑文档')
	if (![1, 2].includes(doc.status)) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '当前文档状态不允许创建快照')
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

	// 3. 读取草稿内容并生成快照文件
	const content = doc.draft_content ?? ''
	const buffer = Buffer.from(content, 'utf-8')
	const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
	const snapshotId = generateId()
	const storageKey = `snapshots/${docId}/${snapshotId}.md`

	// 4. 写入对象存储
	await storage.putObject(storageKey, buffer, {
		mimeType: 'text/markdown; charset=utf-8',
		checksum,
	})

	// 5. 写入数据库
	await prisma.doc_document_snapshots.create({
		data: {
			id: snapshotId,
			document_id: docId,
			type: 2,
			name: body.name,
			storage_key: storageKey,
			file_size: BigInt(buffer.byteLength),
			created_by: BigInt(user.id),
		},
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_SNAPSHOT_CREATE,
		targetType: 'document',
		targetId: Number(docId),
		documentId: Number(docId),
		detail: { desc: `创建快照「${body.name}」`, snapshotId: Number(snapshotId) },
	})

	return ok({ id: Number(snapshotId) }, '快照已保存')
})
