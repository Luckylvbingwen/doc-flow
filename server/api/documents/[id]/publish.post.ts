/**
 * POST /api/documents/:id/publish
 * 个人中心草稿发布到组（PRD §6.5.2 操作矩阵 — 提交发布）
 *
 * body:
 *   - mode: 'new' | 'update'
 *   - targetGroupId: number
 *   - targetDocId?: number  (update 模式必填)
 *   - remark?: string
 *
 * 两种模式：
 *   new    — 草稿归组 + 走审批/直发布（executeUpload mode='resubmit'）
 *   update — 把草稿文件作为目标文档的新版本（executeUpload mode='update' 逻辑）
 *
 * 鉴权：approval:read（任何登录用户可发布自己的草稿）
 */
import { prisma } from '~/server/utils/prisma'
import { documentPublishSchema } from '~/server/schemas/document'
import { executeUpload, incrementVersion } from '~/server/utils/document-upload'
import { generateId } from '~/server/utils/snowflake'
import { writeLog } from '~/server/utils/operation-log'
import { freezeOldAnnotations } from '~/server/utils/annotation-freeze'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { storage } from '~/server/utils/storage'
import {
	AUTH_REQUIRED,
	DOCUMENT_NOT_FOUND,
	DOCUMENT_STATUS_INVALID,
	GROUP_NOT_FOUND,
	PERMISSION_DENIED,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'approval:read')
	if (permErr) return permErr
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const docIdParam = getRouterParam(event, 'id')
	const docId = Number(docIdParam)
	if (!Number.isFinite(docId) || docId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 无效')
	}

	const body = await readValidatedBody(event, documentPublishSchema.parse)

	// ── 查询草稿文档 ──
	const doc = await prisma.doc_documents.findUnique({
		where: { id: BigInt(docId) },
		select: {
			id: true,
			title: true,
			ext: true,
			status: true,
			group_id: true,
			owner_user_id: true,
			current_version_id: true,
			deleted_at: true,
			doc_type: true,
			draft_content: true,
		},
	})
	if (!doc || doc.deleted_at) {
		return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	}
	// 权限：归属人 或 拥有编辑权限的协作者（PRD §6.5.2 编辑中+可编辑可提交发布）
	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: BigInt(docId), user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) {
			return fail(event, 403, PERMISSION_DENIED, '仅归属人或拥有编辑权限的协作者可发布')
		}
	}
	// 仅草稿(1)、编辑中(2)和已驳回(5)可发布
	if (doc.status !== 1 && doc.status !== 2 && doc.status !== 5) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅草稿、编辑中或已驳回文档可提交发布')
	}

	// ── 校验目标组存在 ──
	const targetGroup = await prisma.doc_groups.findFirst({
		where: { id: BigInt(body.targetGroupId), deleted_at: null },
		select: { id: true, name: true },
	})
	if (!targetGroup) {
		return fail(event, 404, GROUP_NOT_FOUND, '目标组不存在')
	}

	// ── 查询当前版本 ──
	const currentVersion = doc.current_version_id
		? await prisma.doc_document_versions.findFirst({
			where: { id: doc.current_version_id, deleted_at: null },
			select: { id: true, version_no: true, storage_key: true, storage_bucket: true, file_size: true, mime_type: true, checksum: true },
		})
		: null

	// ── 在线文档发布：将 draft_content 材料化为 MinIO 版本 ──
	if (doc.doc_type === 2 && !currentVersion) {
		if (!doc.draft_content) {
			return fail(event, 409, DOCUMENT_STATUS_INVALID, '草稿内容为空，无法发布')
		}
		const versionId = generateId()
		const storageKey = `documents/${doc.id}/v1.0/${versionId}.md`
		const contentBuffer = Buffer.from(doc.draft_content, 'utf-8')
		await storage.putObject(storageKey, contentBuffer, { mimeType: 'text/markdown; charset=utf-8' })

		const newVersion = await prisma.doc_document_versions.create({
			data: {
				id: BigInt(versionId),
				document_id: doc.id,
				version_no: 'v1.0',
				storage_key: storageKey,
				storage_bucket: storage.bucket,
				file_size: BigInt(contentBuffer.length),
				mime_type: 'text/markdown',
				uploaded_by: BigInt(user.id),
			},
		})

		await prisma.doc_documents.update({
			where: { id: doc.id },
			data: { current_version_id: BigInt(versionId) },
		})
		await freezeOldAnnotations(doc.id, BigInt(versionId))

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			; (currentVersion as any) = newVersion
	}

	if (!currentVersion) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '草稿没有可发布的版本')
	}

	if (body.mode === 'new') {
		// ════════════════════════════════════════════
		// 首次发布：草稿归组 → 走 resubmit 路径
		// ════════════════════════════════════════════

		// 先把 group_id 写入文档（归组）
		await prisma.doc_documents.update({
			where: { id: doc.id },
			data: {
				group_id: targetGroup.id,
				updated_by: BigInt(user.id),
				updated_at: new Date(),
			},
		})

		// 调用 executeUpload(resubmit) 走审批判定
		const result = await executeUpload({
			mode: 'resubmit',
			submitterId: user.id,
			submitterName: user.name ?? '',
			groupId: body.targetGroupId,
			documentId: doc.id,
			versionId: currentVersion.id,
			title: doc.title,
			ext: doc.ext ?? 'md',
			versionNo: currentVersion.version_no,
			changeNote: body.remark ?? null,
			storageKey: '',
			storageBucket: '',
			fileSize: 0,
			mimeType: '',
			checksum: '',
		})

		await writeLog({
			actorUserId: user.id,
			action: LOG_ACTIONS.DOC_PUBLISH,
			targetType: 'document',
			targetId: docId,
			groupId: body.targetGroupId,
			documentId: docId,
			detail: { desc: `提交发布「${doc.title}」到组「${targetGroup.name}」`, mode: 'new' },
		})

		return ok(
			{
				documentId: docId,
				path: result.path,
				approvalInstanceId: result.approvalInstanceId,
			},
			result.path === 'direct_publish' ? '已直接发布' : '已提交审批',
		)
	}

	// ════════════════════════════════════════════
	// 版本迭代：把草稿作为目标文档的新版本
	// ════════════════════════════════════════════
	if (!body.targetDocId) {
		return fail(event, 400, INVALID_PARAMS, '版本迭代模式必须指定目标文档')
	}

	const targetDoc = await prisma.doc_documents.findFirst({
		where: { id: BigInt(body.targetDocId), group_id: targetGroup.id, deleted_at: null },
		select: { id: true, title: true, ext: true, status: true, owner_user_id: true },
	})
	if (!targetDoc) {
		return fail(event, 404, DOCUMENT_NOT_FOUND, '目标文档不存在')
	}
	// 目标文档必须已发布
	if (targetDoc.status !== 4) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '目标文档未发布，无法迭代版本')
	}

	// 取目标文档最新版本号
	const latestVersion = await prisma.doc_document_versions.findFirst({
		where: { document_id: targetDoc.id, deleted_at: null },
		orderBy: { created_at: 'desc' },
		select: { version_no: true },
	})
	const newVersionNo = incrementVersion(latestVersion?.version_no)
	const newVersionId = generateId()

	// 用目标文档走 executeUpload(update)
	const result = await executeUpload({
		mode: 'update',
		submitterId: user.id,
		submitterName: user.name ?? '',
		groupId: body.targetGroupId,
		documentId: targetDoc.id,
		versionId: newVersionId,
		title: targetDoc.title,
		ext: targetDoc.ext ?? 'md',
		versionNo: newVersionNo,
		changeNote: body.remark ?? null,
		storageKey: currentVersion.storage_key,
		storageBucket: currentVersion.storage_bucket ?? 'documents',
		fileSize: Number(currentVersion.file_size),
		mimeType: currentVersion.mime_type ?? '',
		checksum: currentVersion.checksum ?? '',
	})

	// 标记原草稿为已删除（已合并到目标文档）
	await prisma.doc_documents.update({
		where: { id: doc.id },
		data: {
			status: 6,
			deleted_at: new Date(),
			updated_by: BigInt(user.id),
		},
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_PUBLISH,
		targetType: 'document',
		targetId: Number(targetDoc.id),
		groupId: body.targetGroupId,
		documentId: Number(targetDoc.id),
		detail: {
			desc: `版本迭代发布「${doc.title}」→「${targetDoc.title}」${newVersionNo}`,
			mode: 'update',
			sourceDocId: docId,
		},
	})

	return ok(
		{
			documentId: Number(targetDoc.id),
			versionId: Number(newVersionId),
			path: result.path,
			approvalInstanceId: result.approvalInstanceId,
		},
		result.path === 'direct_publish' ? '已直接发布' : '已提交审批',
	)
})
