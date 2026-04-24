/**
 * POST /api/version/compare
 * 版本对比（接入真实存储）
 *
 * 入参：{ documentId, fromVersionId, toVersionId }
 *   - fromVersionId = 当前版本 / 新版本
 *   - toVersionId   = 被对比的历史版本 / 旧版本
 *
 * 流程：查 DB → storage.getObject 两份 Buffer → extractText → computeLineDiff → mergeAdjacentDiffs → buildDiffSummary → renderDiffHtml
 */
import { prisma } from '~/server/utils/prisma'
import { storage } from '~/server/utils/storage'
import { versionCompareSchema } from '~/server/schemas/version'
import {
	computeLineDiff,
	mergeAdjacentDiffs,
	buildDiffSummary,
	renderDiffHtml,
} from '~/server/utils/diff'
import { extractText, isSupportedFormat } from '~/server/utils/extract'
import {
	DOCUMENT_NOT_FOUND,
	VERSION_NOT_FOUND,
	FILE_FORMAT_UNSUPPORTED,
	STORAGE_GET_FAILED,
} from '~/server/constants/error-codes'
import type { CompareResult } from '~/types/version'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr

	const body = await readValidatedBody(event, versionCompareSchema.parse)
	const docId = BigInt(body.documentId)
	const fromId = BigInt(body.fromVersionId)
	const toId = BigInt(body.toVersionId)

	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: { id: true, title: true, ext: true, deleted_at: true },
	})
	if (!doc || doc.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const [fromVer, toVer] = await Promise.all([
		prisma.doc_document_versions.findFirst({
			where: { id: fromId, document_id: docId, deleted_at: null },
			select: { id: true, version_no: true, storage_key: true, file_size: true, mime_type: true },
		}),
		prisma.doc_document_versions.findFirst({
			where: { id: toId, document_id: docId, deleted_at: null },
			select: { id: true, version_no: true, storage_key: true, file_size: true, mime_type: true },
		}),
	])
	if (!fromVer || !toVer) return fail(event, 404, VERSION_NOT_FOUND, '版本不存在')

	const ext = (doc.ext ?? 'md').toLowerCase()
	if (!isSupportedFormat(ext)) {
		return fail(event, 400, FILE_FORMAT_UNSUPPORTED, `暂不支持对比 .${ext} 格式`)
	}

	let fromBuf: Buffer
	let toBuf: Buffer
	try {
		const [a, b] = await Promise.all([
			storage.getObject(fromVer.storage_key),
			storage.getObject(toVer.storage_key),
		])
		fromBuf = a
		toBuf = b
	} catch (e) {
		console.error('[compare] storage.getObject failed', e)
		return fail(event, 500, STORAGE_GET_FAILED, '读取对比文件失败')
	}

	const [newText, oldText] = await Promise.all([
		extractText(fromBuf, ext),
		extractText(toBuf, ext),
	])

	const rawChunks = computeLineDiff(oldText, newText)
	const chunks = mergeAdjacentDiffs(rawChunks)
	const summary = buildDiffSummary(chunks, Number(toVer.file_size), Number(fromVer.file_size))
	const { newHtml, oldHtml } = renderDiffHtml(chunks, ext)

	const result: CompareResult = {
		documentId: body.documentId,
		fileName: doc.title,
		fileType: ext,
		newVersion: {
			versionId: Number(fromVer.id),
			versionNo: fromVer.version_no,
			html: newHtml,
		},
		oldVersion: {
			versionId: Number(toVer.id),
			versionNo: toVer.version_no,
			html: oldHtml,
		},
		summary,
		chunks,
	}
	return ok(result)
})
