/**
 * GET /api/documents/:id/snapshots
 * 快照 + 已发布版本合并时间轴（最近 50 条快照 + 全部已发布版本，按时间降序）
 */
import { prisma } from '~/server/utils/prisma'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	PERMISSION_DENIED,
} from '~/server/constants/error-codes'

interface TimelineItem {
	id: number
	kind: 'snapshot' | 'version'
	label: string
	authorName: string
	createdAt: number
}

interface SnapshotRow {
	id: bigint
	type: number
	name: string | null
	created_by: bigint
	author_name: string
	created_at: Date
}

interface VersionRow {
	id: bigint
	version_no: string
	uploaded_by: bigint
	author_name: string
	published_at: Date | null
	created_at: Date
}

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, owner_user_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	// 权限：归属人 或 有编辑权限（permission <= 2）
	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) return fail(event, 403, PERMISSION_DENIED, '无权访问此文档的快照')
	}

	// 查询快照列表（最近 50 条）
	const snapshots = await prisma.$queryRaw<SnapshotRow[]>`
		SELECT
			s.id, s.type, s.name, s.created_by, s.created_at,
			u.name AS author_name
		FROM doc_document_snapshots s
		JOIN doc_users u ON u.id = s.created_by
		WHERE s.document_id = ${docId}
		ORDER BY s.created_at DESC
		LIMIT 50
	`

	// 查询已发布版本列表
	const versions = await prisma.$queryRaw<VersionRow[]>`
		SELECT
			v.id, v.version_no, v.uploaded_by, v.published_at, v.created_at,
			u.name AS author_name
		FROM doc_document_versions v
		JOIN doc_users u ON u.id = v.uploaded_by
		WHERE v.document_id = ${docId}
		  AND v.deleted_at IS NULL
		ORDER BY v.created_at DESC
	`

	// 合并并构建时间轴条目
	const snapshotItems: TimelineItem[] = snapshots.map(s => {
		let label: string
		if (s.name) {
			label = s.name
		} else if (s.type === 1) {
			label = '自动保存'
		} else {
			label = '快照'
		}
		return {
			id: Number(s.id),
			kind: 'snapshot',
			label,
			authorName: s.author_name,
			createdAt: s.created_at.getTime(),
		}
	})

	const versionItems: TimelineItem[] = versions.map(v => ({
		id: Number(v.id),
		kind: 'version',
		label: v.version_no,
		authorName: v.author_name,
		createdAt: (v.published_at ?? v.created_at).getTime(),
	}))

	// 合并后按 createdAt 降序排序
	const list = [...snapshotItems, ...versionItems].sort((a, b) => b.createdAt - a.createdAt)

	return ok({ list })
})
