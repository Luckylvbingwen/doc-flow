/**
 * GET /api/documents/:id/download
 * 下载（PRD §6.3.4）
 *
 * query: { versionId?: number }   缺省取 current_version_id
 *
 * 业务：
 *   1. 权限 doc:download
 *   2. 查 version + doc
 *   3. 生成 10 分钟有效的 presigned URL
 *   4. 异步 UPDATE download_count + 1（不阻塞响应）
 *   5. 写 DOC_DOWNLOAD 操作日志
 *   6. 302 重定向到 presigned URL
 */
import { prisma } from '~/server/utils/prisma'
import { storage } from '~/server/utils/storage'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { documentDownloadQuerySchema } from '~/server/schemas/document'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	VERSION_NOT_FOUND,
	STORAGE_GET_FAILED,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:download')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	const { versionId } = await getValidatedQuery(event, documentDownloadQuerySchema.parse)

	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: {
			id: true,
			title: true,
			ext: true,
			group_id: true,
			current_version_id: true,
			deleted_at: true,
		},
	})
	if (!doc || doc.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const targetVersionId = versionId ? BigInt(versionId) : doc.current_version_id
	if (!targetVersionId) return fail(event, 404, VERSION_NOT_FOUND, '文档尚无可下载版本')

	const version = await prisma.doc_document_versions.findFirst({
		where: {
			id: targetVersionId,
			document_id: docId,
			deleted_at: null,
		},
		select: {
			id: true,
			version_no: true,
			storage_key: true,
		},
	})
	if (!version) return fail(event, 404, VERSION_NOT_FOUND, '版本不存在')

	let preUrl: string
	try {
		preUrl = await storage.presignGetUrl(version.storage_key, 600)
	} catch (e) {
		console.error('[download] presign failed', e)
		return fail(event, 500, STORAGE_GET_FAILED, '生成下载链接失败')
	}

	// 异步计数 + 日志，不阻塞响应
	prisma.doc_documents.update({
		where: { id: docId },
		data: { download_count: { increment: 1 } },
	}).catch(err => console.error('[download] download_count update failed', err))

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_DOWNLOAD,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: doc.group_id != null ? Number(doc.group_id) : null,
		documentId: Number(doc.id),
		detail: { desc: `下载文件「${doc.title}」${version.version_no}`, versionNo: version.version_no },
	})

	return sendRedirect(event, preUrl, 302)
})
