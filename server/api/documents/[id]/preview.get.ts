/**
 * GET /api/documents/:id/preview
 * 预览（服务端渲染 MD 返回 HTML，Redis 5 分钟缓存）
 *
 * query: { versionId?: number }   缺省取 current_version_id
 *
 * A 阶段仅支持 .md；其他 mime 直接返回"暂不支持预览"占位 HTML。
 */
import { prisma } from '~/server/utils/prisma'
import { storage } from '~/server/utils/storage'
import { getRedis } from '~/server/utils/redis'
import { renderMarkdown } from '~/server/utils/markdown'
import { documentPreviewQuerySchema } from '~/server/schemas/document'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	VERSION_NOT_FOUND,
	STORAGE_GET_FAILED,
} from '~/server/constants/error-codes'
import type { PreviewResponse } from '~/types/document'

const CACHE_TTL_SECONDS = 300
const UNSUPPORTED_HTML = '<div class="df-preview-unsupported">暂不支持预览此格式</div>'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	const { versionId } = await getValidatedQuery(event, documentPreviewQuerySchema.parse)

	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: {
			id: true,
			current_version_id: true,
			deleted_at: true,
		},
	})
	if (!doc || doc.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const targetVersionId = versionId ? BigInt(versionId) : doc.current_version_id
	if (!targetVersionId) return fail(event, 404, VERSION_NOT_FOUND, '文档尚无可预览版本')

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
			mime_type: true,
		},
	})
	if (!version) return fail(event, 404, VERSION_NOT_FOUND, '版本不存在')

	const mime = version.mime_type ?? ''
	const isMd = mime === 'text/markdown' || mime.startsWith('text/markdown')

	// 非 MD 直接兜底（不缓存，代价低）
	if (!isMd) {
		const resp: PreviewResponse = {
			html: UNSUPPORTED_HTML,
			versionNo: version.version_no,
			mimeType: mime,
		}
		return ok(resp)
	}

	// Redis 缓存命中
	const redis = getRedis()
	const cacheKey = `preview:${version.id}`
	if (redis) {
		try {
			const cached = await redis.get(cacheKey)
			if (cached) {
				const resp: PreviewResponse = {
					html: cached,
					versionNo: version.version_no,
					mimeType: mime,
				}
				return ok(resp)
			}
		} catch (e) {
			console.warn('[preview] redis get failed', e)
		}
	}

	// 读对象存储 → 渲染
	let content: string
	try {
		const buf = await storage.getObject(version.storage_key)
		content = buf.toString('utf-8')
	} catch (e) {
		console.error('[preview] storage.getObject failed', e)
		return fail(event, 500, STORAGE_GET_FAILED, '读取文件失败')
	}

	const html = renderMarkdown(content)

	if (redis) {
		redis.set(cacheKey, html, 'EX', CACHE_TTL_SECONDS).catch(
			e => console.warn('[preview] redis set failed', e),
		)
	}

	const resp: PreviewResponse = {
		html,
		versionNo: version.version_no,
		mimeType: mime,
	}
	return ok(resp)
})
