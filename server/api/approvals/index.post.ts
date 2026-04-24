/**
 * POST /api/approvals
 * 起审批（PRD §5.1 / §6.3.4 — 草稿 / 已驳回文档「提交审批」按钮）
 *
 * body:
 *   - documentId: number
 *   - versionId:  number   必填；必须属于该文档且未删除
 *
 * 业务：
 *   1. 权限 approval:read（任何员工可发起自己的审批）
 *   2. 文档 owner=self + status ∈ {1 草稿, 5 已驳回}
 *   3. 版本属于该文档、未删除
 *   4. 调用 executeUpload(mode='resubmit') 复用路径判定 / 状态流转 / M1-M8 / 日志
 */
import { prisma } from '~/server/utils/prisma'
import { approvalSubmitSchema } from '~/server/schemas/approval-runtime'
import { executeUpload } from '~/server/utils/document-upload'
import {
	AUTH_REQUIRED,
	DOCUMENT_NOT_FOUND,
	DOCUMENT_STATUS_INVALID,
	VERSION_NOT_FOUND,
	PERMISSION_DENIED,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'approval:read')
	if (permErr) return permErr
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const body = await readValidatedBody(event, approvalSubmitSchema.parse)
	const docId = BigInt(body.documentId)
	const versionId = BigInt(body.versionId)

	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: {
			id: true,
			title: true,
			ext: true,
			status: true,
			group_id: true,
			owner_user_id: true,
			deleted_at: true,
		},
	})
	if (!doc || doc.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (Number(doc.owner_user_id) !== user.id) {
		return fail(event, 403, PERMISSION_DENIED, '仅归属人可提交审批')
	}
	if (doc.status !== 1 && doc.status !== 5) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅草稿或已驳回文档可提交审批')
	}
	if (!doc.group_id) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '个人草稿尚未归组，无法提交审批')
	}

	const version = await prisma.doc_document_versions.findFirst({
		where: { id: versionId, document_id: docId, deleted_at: null },
		select: { id: true, version_no: true },
	})
	if (!version) return fail(event, 404, VERSION_NOT_FOUND, '版本不存在')

	const result = await executeUpload({
		mode: 'resubmit',
		submitterId: user.id,
		submitterName: user.name ?? '',
		groupId: Number(doc.group_id),
		documentId: doc.id,
		versionId: version.id,
		title: doc.title,
		ext: doc.ext ?? 'md',
		versionNo: version.version_no,
		changeNote: null,
		storageKey: '',
		storageBucket: '',
		fileSize: 0,
		mimeType: '',
		checksum: '',
	})

	return ok(
		{
			approvalInstanceId: result.approvalInstanceId,
			path: result.path,
		},
		result.path === 'direct_publish' ? '已直接发布' : '已提交审批',
	)
})
