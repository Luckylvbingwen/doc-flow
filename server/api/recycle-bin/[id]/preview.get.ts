/**
 * GET /api/recycle-bin/:id/preview
 * 回收站文件预览（PRD §6.6.2 "仅展示改版正文"）
 *
 * 仅对已删除文档有效，需 recycle:read 权限 + 数据范围校验
 */
import { prisma } from '~/server/utils/prisma'
import { storage } from '~/server/utils/storage'
import { renderMarkdown } from '~/server/utils/markdown'
import { buildRecycleScopeFilter } from '~/server/utils/recycle-scope'
import {
	INVALID_PARAMS,
	RECYCLE_NOT_FOUND,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'recycle:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	// 数据范围校验
	const scopeFilter = await buildRecycleScopeFilter(user.id)

	const rows = await prisma.$queryRaw<Array<{
		id: bigint
		title: string
		storage_key: string
		mime_type: string | null
		version_no: string
	}>>`
		SELECT d.id, d.title, v.storage_key, v.mime_type, v.version_no
		FROM doc_documents d
		JOIN doc_document_versions v ON v.id = d.current_version_id
		WHERE d.id = ${docId}
		  AND d.deleted_at IS NOT NULL
		  AND (${scopeFilter})
		LIMIT 1
	`

	const row = rows[0]
	if (!row) return fail(event, 404, RECYCLE_NOT_FOUND, '回收站中未找到该文档')

	const mime = row.mime_type ?? ''
	const isMd = mime === 'text/markdown' || mime.startsWith('text/markdown')

	if (!isMd) {
		return ok({
			html: '<div class="df-preview-unsupported">暂不支持预览此格式</div>',
			title: row.title,
			versionNo: row.version_no,
		})
	}

	try {
		const buf = await storage.getObject(row.storage_key)
		const md = buf.toString('utf-8')
		const html = renderMarkdown(md)
		return ok({ html, title: row.title, versionNo: row.version_no })
	} catch (e) {
		console.error('[recycle-preview] storage read failed', e)
		return ok({
			html: '<div class="df-preview-unsupported">文件存储已过期，无法预览</div>',
			title: row.title,
			versionNo: row.version_no,
		})
	}
})
