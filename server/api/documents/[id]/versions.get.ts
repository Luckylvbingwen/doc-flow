/**
 * GET /api/documents/:id/versions
 * 版本列表（PRD §6.3.4 文件详情右侧 VersionSidebar）
 *
 * query: page / pageSize（见 server/schemas/version.ts versionListQuerySchema）
 * 返回结构对齐 types/version.ts VersionInfo[]
 */
import { prisma } from '~/server/utils/prisma'
import { versionListQuerySchema } from '~/server/schemas/version'
import { INVALID_PARAMS, DOCUMENT_NOT_FOUND } from '~/server/constants/error-codes'
import type { VersionInfo } from '~/types/version'

interface Row {
	id: bigint
	document_id: bigint
	version_no: string
	file_size: bigint
	mime_type: string | null
	change_note: string | null
	uploaded_by: bigint
	uploader_name: string
	published_at: Date | null
	created_at: Date
	current_version_id: bigint | null
	source_meta: { rollbackFrom?: string } | null
}

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	const query = await getValidatedQuery(event, versionListQuerySchema.parse)
	const { page, pageSize } = query
	const offset = (page - 1) * pageSize

	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: { id: true, deleted_at: true },
	})
	if (!doc || doc.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const rows = await prisma.$queryRaw<Row[]>`
		SELECT
			v.id, v.document_id, v.version_no, v.file_size, v.mime_type,
			v.change_note, v.uploaded_by, v.published_at, v.created_at,
			v.source_meta,
			u.name AS uploader_name,
			d.current_version_id
		FROM doc_document_versions v
		JOIN doc_documents d ON d.id = v.document_id
		JOIN doc_users u ON u.id = v.uploaded_by
		WHERE v.document_id = ${docId}
		  AND v.deleted_at IS NULL
		ORDER BY v.created_at DESC
		LIMIT ${pageSize} OFFSET ${offset}
	`

	const [{ cnt: totalBig }] = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
		SELECT COUNT(*) AS cnt
		FROM doc_document_versions
		WHERE document_id = ${docId} AND deleted_at IS NULL
	`

	const list: VersionInfo[] = rows.map(r => ({
		id:            Number(r.id),
		documentId:    Number(r.document_id),
		versionNo:     r.version_no,
		fileSize:      Number(r.file_size),
		mimeType:      r.mime_type,
		changeNote:    r.change_note,
		uploadedBy:    Number(r.uploaded_by),
		uploaderName:  r.uploader_name,
		publishedAt:   r.published_at?.getTime() ?? null,
		createdAt:     r.created_at.getTime(),
		isCurrent:     r.current_version_id != null && r.current_version_id === r.id,
		rollbackFrom:  r.source_meta?.rollbackFrom ?? null,
	}))

	return ok({ list, total: Number(totalBig), page, pageSize })
})
