/**
 * GET /api/documents/:id
 * 文件详情（PRD §6.3.4）
 *
 * 单次 JOIN 出文档 + 当前版本 + 组名 + owner 名，含当前用户动作权限标志
 */
import { prisma } from '~/server/utils/prisma'
import { canUserPinInGroup } from '~/server/utils/group-permission'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
} from '~/server/constants/error-codes'
import type { DocumentDetail, DocumentStatus } from '~/types/document'

interface Row {
	id: bigint
	title: string
	ext: string | null
	status: number
	group_id: bigint | null
	group_name: string | null
	source_doc_id: bigint | null
	doc_type: number
	owner_user_id: bigint
	owner_name: string
	created_at: Date
	updated_at: Date
	download_count: number
	is_pinned: number
	is_favorited: number
	has_custom_permissions: number
	member_role: number | null
	cv_id: bigint | null
	cv_version_no: string | null
	cv_file_size: bigint | null
	cv_mime_type: string | null
	cv_uploader_name: string | null
	cv_published_at: Date | null
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

	const rows = await prisma.$queryRaw<Row[]>`
		SELECT
			d.id, d.title, d.ext, d.status, d.group_id, d.source_doc_id, d.doc_type,
			d.owner_user_id, d.download_count, d.created_at, d.updated_at,
			g.name AS group_name,
			u.name AS owner_name,
			(p.id IS NOT NULL) AS is_pinned,
			(f.id IS NOT NULL) AS is_favorited,
			(EXISTS(
				SELECT 1 FROM doc_document_permissions dp
				WHERE dp.document_id = d.id AND dp.deleted_at IS NULL
			)) AS has_custom_permissions,
			gm.role AS member_role,
			v.id           AS cv_id,
			v.version_no   AS cv_version_no,
			v.file_size    AS cv_file_size,
			v.mime_type    AS cv_mime_type,
			vu.name        AS cv_uploader_name,
			v.published_at AS cv_published_at
		FROM doc_documents d
		JOIN doc_users u ON u.id = d.owner_user_id
		LEFT JOIN doc_groups g ON g.id = d.group_id
		LEFT JOIN doc_document_versions v ON v.id = d.current_version_id
		LEFT JOIN doc_users vu ON vu.id = v.uploaded_by
		LEFT JOIN doc_document_pins p
			ON p.document_id = d.id AND p.group_id = d.group_id
		LEFT JOIN doc_document_favorites f
			ON f.document_id = d.id AND f.user_id = ${BigInt(user.id)}
		LEFT JOIN doc_group_members gm
			ON gm.group_id = d.group_id AND gm.user_id = ${BigInt(user.id)} AND gm.deleted_at IS NULL
		WHERE d.id = ${docId}
		  AND d.deleted_at IS NULL
		LIMIT 1
	`

	const row = rows[0]
	if (!row) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

	const status = row.status as DocumentStatus
	const isOwner = Number(row.owner_user_id) === user.id
	const memberRole = row.member_role
	const isGroupAdmin = memberRole === 1
	const canEditInGroup = memberRole === 1 || memberRole === 2

	const canPin = await canUserPinInGroup(
		user.id,
		row.group_id != null ? Number(row.group_id) : null,
	)

	// 查询是否有待处理的归属人转移
	const pendingTransferRow = await prisma.doc_ownership_transfers.findFirst({
		where: { document_id: docId, status: 1 },
		select: { expires_at: true },
	})
	const hasPendingTransfer = pendingTransferRow ? pendingTransferRow.expires_at > new Date() : false

	// PRD §6.3.8 申请编辑权限：可阅读权限用户且无待处理的 type=2 申请
	let myDocPermission: number | null = null
	if (!isOwner) {
		const myPerm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		myDocPermission = myPerm?.permission ?? null
	}
	const pendingEditRequest = myDocPermission === 4
		? await prisma.doc_permission_requests.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), type: 2, status: 1 },
			select: { id: true },
		})
		: null

	const detail: DocumentDetail = {
		id: Number(row.id),
		title: row.title,
		ext: row.ext ?? '',
		status,
		groupId: row.group_id != null ? Number(row.group_id) : null,
		groupName: row.group_name,
		ownerId: Number(row.owner_user_id),
		ownerName: row.owner_name,
		currentVersion: row.cv_id ? {
			id: Number(row.cv_id),
			versionNo: row.cv_version_no!,
			fileSize: Number(row.cv_file_size!),
			mimeType: row.cv_mime_type,
			uploadedByName: row.cv_uploader_name ?? '',
			publishedAt: row.cv_published_at?.getTime() ?? null,
		} : null,
		createdAt: row.created_at.getTime(),
		updatedAt: row.updated_at.getTime(),
		downloadCount: row.download_count,
		isPinned: Number(row.is_pinned) === 1,
		isFavorited: Number(row.is_favorited) === 1,
		hasCustomPermissions: Number(row.has_custom_permissions) === 1,
		sourceDocId: row.source_doc_id != null ? Number(row.source_doc_id) : null,
		docType: Number(row.doc_type),
		canEdit: isOwner && Number(row.doc_type) === 2 && status === 4,
		canRemove: isGroupAdmin && status === 4,
		canSubmitApproval: isOwner && (status === 1 || status === 5),
		canUploadVersion: canEditInGroup && (status === 4 || status === 5),
		canPin,
		canManagePermissions: canPin,  // 与 canPin 同口径（PRD §6.3.4 仅组管理员可配置）
		canRollback: canPin && status === 4,  // 版本回滚：组管理员 + 已发布（PRD §4.3）
		canTransfer: isOwner && status === 4 && !hasPendingTransfer,
		hasPendingTransfer,
		canRequestEditPermission: !isOwner && status === 4 && myDocPermission === 4 && !pendingEditRequest,
		myDocPermission,
	}

	return ok(detail)
})
