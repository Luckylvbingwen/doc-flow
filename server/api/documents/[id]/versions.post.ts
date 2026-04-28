/**
 * POST /api/documents/:id/versions
 * 更新版本（PRD §6.3.4 文件详情「上传新版本」）
 *
 * multipart/form-data：
 *   - changeNote: string?   （可选）
 *   - file:       binary    （必填，支持 .md/.docx/.xlsx/.pdf，50MB 上限）
 *
 * 业务：
 *   1. 权限 doc:update + 组内 role ∈ {1 管理员, 2 可编辑}
 *   2. 文档 status ∈ {4 已发布, 5 已驳回}，否则 DOCUMENT_STATUS_INVALID
 *   3. 版本号从 MAX(version_no) 解析 Y+1（v1.0 → v1.1，v1.9 → v1.10）
 *   4. 存 MinIO → executeUpload(mode='update')
 */
import { readMultipartFormData } from 'h3'
import { createHash } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { storage, buildStorageKey } from '~/server/utils/storage'
import { converter } from '~/server/utils/format-converter'
import { generateId } from '~/server/utils/snowflake'
import { documentVersionUploadFieldsSchema } from '~/server/schemas/document'
import { executeUpload, incrementVersion } from '~/server/utils/document-upload'
import {
	INVALID_PARAMS,
	PERMISSION_DENIED,
	DOCUMENT_NOT_FOUND,
	DOCUMENT_STATUS_INVALID,
	FILE_TOO_LARGE,
	FILE_FORMAT_UNSUPPORTED,
	FILE_CONVERT_FAILED,
	STORAGE_PUT_FAILED,
} from '~/server/constants/error-codes'

const MAX_SIZE = 50 * 1024 * 1024

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:update')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const documentId = BigInt(idStr)

	// 1. 文档 + 状态校验
	const doc = await prisma.doc_documents.findUnique({
		where: { id: documentId },
		select: {
			id: true,
			group_id: true,
			title: true,
			ext: true,
			status: true,
			deleted_at: true,
		},
	})
	if (!doc || doc.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (!doc.group_id) return fail(event, 409, DOCUMENT_STATUS_INVALID, '个人草稿不支持更新版本')
	if (doc.status !== 4 && doc.status !== 5) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅已发布或已驳回的文档可上传新版本')
	}

	// 2. 组内角色校验：管理员 / 可编辑
	const member = await prisma.doc_group_members.findFirst({
		where: {
			group_id: doc.group_id,
			user_id: BigInt(user.id),
			role: { in: [1, 2] },
			deleted_at: null,
		},
		select: { id: true },
	})
	if (!member) return fail(event, 403, PERMISSION_DENIED, '仅组管理员 / 可编辑成员可上传新版本')

	// 3. 解析 multipart
	const parts = await readMultipartFormData(event)
	if (!parts) return fail(event, 400, INVALID_PARAMS, '请求体非法')

	const fields: Record<string, string> = {}
	let fileBuf: Buffer | null = null
	let originalFilename = ''
	for (const p of parts) {
		if (p.name === 'file' && p.filename) {
			fileBuf = p.data
			originalFilename = p.filename
		} else if (p.name) {
			fields[p.name] = p.data.toString('utf-8')
		}
	}
	if (!fileBuf) return fail(event, 400, INVALID_PARAMS, '缺少文件')

	const parsed = documentVersionUploadFieldsSchema.safeParse(fields)
	if (!parsed.success) {
		return fail(event, 400, INVALID_PARAMS, parsed.error.issues[0]?.message || '字段非法')
	}
	const { changeNote } = parsed.data

	if (fileBuf.length > MAX_SIZE) {
		return fail(event, 413, FILE_TOO_LARGE, '文件超过 50MB 限制')
	}

	const ext = originalFilename.split('.').pop()?.toLowerCase() || ''
	let contentBuf = fileBuf
	let finalExt = ext
	const mimeType = 'text/markdown'
	if (ext !== 'md') {
		if (!converter.canConvert(ext)) {
			return fail(event, 400, FILE_FORMAT_UNSUPPORTED, '当前仅支持 .md / .docx / .xlsx / .pdf 格式')
		}
		try {
			const { content } = await converter.convert({ buffer: fileBuf, ext, filename: originalFilename })
			contentBuf = Buffer.from(content, 'utf-8')
			finalExt = 'md'
		} catch (e: any) {
			console.error('[versions] converter.convert failed', e)
			return fail(event, 500, FILE_CONVERT_FAILED, '文件格式转换失败，请稍后重试')
		}
	}

	// 4. 取最新版本号，计算 next
	const latest = await prisma.doc_document_versions.findFirst({
		where: { document_id: documentId, deleted_at: null },
		orderBy: { created_at: 'desc' },
		select: { version_no: true },
	})
	const nextVersionNo = incrementVersion(latest?.version_no)

	// 5. 预分配 versionId + checksum + storage_key
	const versionId = generateId()
	const checksum = createHash('sha256').update(contentBuf).digest('hex')
	const storageKey = buildStorageKey({
		groupId: Number(doc.group_id),
		documentId,
		versionNo: nextVersionNo,
		checksum,
		ext: finalExt,
	})

	try {
		await storage.putObject(storageKey, contentBuf, { mimeType })
	} catch (e) {
		console.error('[versions] storage.putObject failed', e)
		return fail(event, 500, STORAGE_PUT_FAILED, '文件存储失败，请稍后重试')
	}

	const result = await executeUpload({
		mode: 'update',
		submitterId: user.id,
		submitterName: user.name ?? '',
		groupId: Number(doc.group_id),
		documentId,
		versionId,
		title: doc.title,
		ext: finalExt,
		versionNo: nextVersionNo,
		changeNote: changeNote ?? null,
		storageKey,
		storageBucket: storage.bucket,
		fileSize: contentBuf.length,
		mimeType,
		checksum,
	})

	return ok(
		result,
		result.path === 'direct_publish' ? '新版本已发布' : '新版本已提交审批',
	)
})
