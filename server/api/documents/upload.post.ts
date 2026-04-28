/**
 * POST /api/documents/upload
 * 首次上传（PRD §6.3.3 共享文档组面板「上传文件」）
 *
 * multipart/form-data：
 *   - groupId:    number     （必填）
 *   - title:      string?    （可选，默认用原文件名去扩展名）
 *   - changeNote: string?    （可选，变更说明）
 *   - file:       binary     （必填，支持 .md/.docx/.xlsx/.pdf，50MB 上限）
 *
 * 业务：
 *   1. 权限 doc:create
 *   2. 解析 multipart + Zod 校验字段
 *   3. 大小 / 扩展名 / 组内同名 三重校验
 *   4. 生成 snowflake id → 计算 checksum → 存 MinIO → 走 executeUpload
 */
import { readMultipartFormData } from 'h3'
import { createHash } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { storage, buildStorageKey } from '~/server/utils/storage'
import { converter } from '~/server/utils/format-converter'
import { generateId } from '~/server/utils/snowflake'
import { documentUploadFieldsSchema } from '~/server/schemas/document'
import { executeUpload } from '~/server/utils/document-upload'
import {
	INVALID_PARAMS,
	FILE_TOO_LARGE,
	FILE_FORMAT_UNSUPPORTED,
	FILE_CONVERT_FAILED,
	DOCUMENT_DUPLICATE_NAME,
	STORAGE_PUT_FAILED,
} from '~/server/constants/error-codes'

const MAX_SIZE = 50 * 1024 * 1024  // 50 MB

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:create')
	if (permErr) return permErr
	const user = event.context.user!

	// 1. 解析 multipart
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

	// 2. Zod 校验 form 字段
	const parsed = documentUploadFieldsSchema.safeParse(fields)
	if (!parsed.success) {
		return fail(event, 400, INVALID_PARAMS, parsed.error.issues[0]?.message || '字段非法')
	}
	const { groupId, title: titleInput, changeNote } = parsed.data

	// 3. 文件大小
	if (fileBuf.length > MAX_SIZE) {
		return fail(event, 413, FILE_TOO_LARGE, '文件超过 50MB 限制')
	}

	// 4. 扩展名 + 格式转换
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
			console.error('[upload] converter.convert failed', e)
			return fail(event, 500, FILE_CONVERT_FAILED, '文件格式转换失败，请稍后重试')
		}
	}

	// 5. 标题（默认去掉扩展名的原文件名）
	const title = (titleInput ?? originalFilename.replace(/\.[^.]+$/, '')).trim()
	if (!title) return fail(event, 400, INVALID_PARAMS, '标题不能为空')

	// 6. 组内同名检测（status IN 3,4；草稿/驳回/已删除同名不冲突，允许另起新建）
	const dup = await prisma.doc_documents.findFirst({
		where: {
			group_id: BigInt(groupId),
			title,
			deleted_at: null,
			status: { in: [3, 4] },
		},
		select: { id: true },
	})
	if (dup) return fail(event, 409, DOCUMENT_DUPLICATE_NAME, '该组已存在同名文件，请使用「更新上传」')

	// 7. 预分配 id + checksum + storage_key
	const documentId = generateId()
	const versionId = generateId()
	const checksum = createHash('sha256').update(contentBuf).digest('hex')
	const storageKey = buildStorageKey({
		groupId,
		documentId,
		versionNo: 'v1.0',
		checksum,
		ext: finalExt,
	})

	// 8. 存 MinIO（事务外，避免拖长事务）
	try {
		await storage.putObject(storageKey, contentBuf, { mimeType })
	} catch (e) {
		console.error('[upload] storage.putObject failed', e)
		return fail(event, 500, STORAGE_PUT_FAILED, '文件存储失败，请稍后重试')
	}

	// 9. 事务 + 通知 + 日志
	const result = await executeUpload({
		mode: 'first',
		submitterId: user.id,
		submitterName: user.name ?? '',
		groupId,
		documentId,
		versionId,
		title,
		ext: finalExt,
		versionNo: 'v1.0',
		changeNote: changeNote ?? null,
		storageKey,
		storageBucket: storage.bucket,
		fileSize: contentBuf.length,
		mimeType,
		checksum,
	})

	return ok(
		result,
		result.path === 'direct_publish' ? '上传并发布成功' : '已提交审批',
	)
})
