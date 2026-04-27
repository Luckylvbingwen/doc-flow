/**
 * POST /api/documents/:id/rollback
 * 版本回滚（PRD §6.3.4 — 回滚生成新版本，不删除中间版本）
 *
 * body: { versionId: number }  — 回滚目标版本
 *
 * 权限：组管理员级别（super_admin / company_admin / dept_head / pl_head / 组内 role=1 / 组负责人）
 * 对应 PRD §4.3 权限矩阵「版本回滚」列
 *
 * 业务：
 *   1. 文档 status=4（已发布） + 已归组
 *   2. 目标版本属于该文档 + 不是当前版本
 *   3. 复用目标版本的 storage_key（文件内容不可变，无需 copy 对象）
 *   4. 创建新版本行，version_no 递增，source_meta 记录 { rollbackFrom: "vX.Y" }
 *   5. 更新 doc.current_version_id
 *   6. 写操作日志
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { incrementVersion } from '~/server/utils/document-upload'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { documentRollbackSchema } from '~/server/schemas/document'
import {
	AUTH_REQUIRED,
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	DOCUMENT_STATUS_INVALID,
	VERSION_NOT_FOUND,
	VERSION_ROLLBACK_SAME,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	// 1. 请求体校验
	const body = await readValidatedBody(event, documentRollbackSchema.parse)

	// 2. 文档校验：存在 + 已发布 + 已归组
	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: {
			id: true,
			title: true,
			ext: true,
			group_id: true,
			status: true,
			current_version_id: true,
			deleted_at: true,
			doc_groups: { select: { scope_type: true, scope_ref_id: true, owner_user_id: true } },
		},
	})
	if (!doc || doc.deleted_at) {
		return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	}
	if (doc.group_id == null || !doc.doc_groups) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '个人草稿不支持版本回滚')
	}
	if (doc.status !== 4) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅已发布的文档可进行版本回滚')
	}

	// 3. 权限校验：组管理员级别
	const permErr = await requireMemberPermission(event, {
		scopeType: doc.doc_groups.scope_type,
		scopeRefId: doc.doc_groups.scope_ref_id != null ? Number(doc.doc_groups.scope_ref_id) : null,
		ownerUserId: doc.doc_groups.owner_user_id != null ? Number(doc.doc_groups.owner_user_id) : null,
		groupId: Number(doc.group_id),
	})
	if (permErr) return permErr

	// 4. 目标版本校验
	const targetVersion = await prisma.doc_document_versions.findFirst({
		where: {
			id: BigInt(body.versionId),
			document_id: docId,
			deleted_at: null,
		},
		select: {
			id: true,
			version_no: true,
			storage_key: true,
			storage_bucket: true,
			file_size: true,
			mime_type: true,
			checksum: true,
		},
	})
	if (!targetVersion) {
		return fail(event, 404, VERSION_NOT_FOUND, '目标版本不存在')
	}
	if (doc.current_version_id && targetVersion.id === doc.current_version_id) {
		return fail(event, 409, VERSION_ROLLBACK_SAME, '不能回滚到当前版本')
	}

	// 5. 计算新版本号
	const latest = await prisma.doc_document_versions.findFirst({
		where: { document_id: docId, deleted_at: null },
		orderBy: { created_at: 'desc' },
		select: { version_no: true },
	})
	const newVersionNo = incrementVersion(latest?.version_no)
	const newVersionId = generateId()

	// 6. 事务：创建新版本 + 更新文档
	await prisma.$transaction(async (tx) => {
		await tx.doc_document_versions.create({
			data: {
				id: newVersionId,
				document_id: docId,
				version_no: newVersionNo,
				storage_key: targetVersion.storage_key,
				storage_bucket: targetVersion.storage_bucket,
				file_size: targetVersion.file_size,
				mime_type: targetVersion.mime_type,
				checksum: targetVersion.checksum,
				source_type: 1,
				source_meta: { rollbackFrom: targetVersion.version_no },
				change_note: `回滚至 ${targetVersion.version_no}`,
				uploaded_by: BigInt(user.id),
				published_at: new Date(),
			},
		})

		await tx.doc_documents.update({
			where: { id: docId },
			data: {
				current_version_id: newVersionId,
				updated_by: BigInt(user.id),
				updated_at: new Date(),
			},
		})
	})

	// 7. 操作日志
	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_ROLLBACK,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: Number(doc.group_id),
		documentId: Number(doc.id),
		detail: {
			desc: `将文件「${doc.title}」从 ${latest?.version_no ?? '-'} 回滚至 ${targetVersion.version_no}，生成新版本 ${newVersionNo}`,
			fromVersion: latest?.version_no ?? null,
			toVersion: targetVersion.version_no,
			newVersion: newVersionNo,
		},
	})

	return ok({
		documentId: Number(docId),
		versionId: Number(newVersionId),
		versionNo: newVersionNo,
		rollbackFrom: targetVersion.version_no,
	}, `已回滚至 ${targetVersion.version_no}，生成新版本 ${newVersionNo}`)
})
