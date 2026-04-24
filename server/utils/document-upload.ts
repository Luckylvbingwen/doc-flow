/**
 * 文档上传共享逻辑（含审批路径判定 + 事务 + 通知 + 日志）
 *
 * 两个入口：
 *   - POST /api/documents/upload           — mode='first'  新文档 + v1.0
 *   - POST /api/documents/:id/versions     — mode='update' 既有文档 + vX.(Y+1)
 *   - POST /api/approvals                  — mode='update' 提交既有草稿/驳回版本重新审批
 *
 * 调用方职责：
 *   1. multipart 解析、大小 / 扩展名校验、同名检测（first only）、文档 status 校验（update only）
 *   2. 预分配 documentId / versionId（generateId()）、计算 checksum / storage_key
 *   3. 调 storage.putObject 把文件先存进对象存储（不在事务内，避免拖长事务）
 *   4. 调 executeUpload(ctx) 做事务落库 + 后续通知日志
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { resolveApprovalPath } from '~/server/utils/approval-router'
import { writeLog } from '~/server/utils/operation-log'
import { createNotification, createNotifications } from '~/server/utils/notify'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import type { UploadResult } from '~/types/document'

export interface UploadContext {
	/**
	 * 三种落库模式：
	 *   - first     首次上传（新文档 + v1.0）          → INSERT doc + INSERT version
	 *   - update    更新版本（既有文档 + 新 vX.Y）       → INSERT version + UPDATE doc
	 *   - resubmit  起审批（既有文档 + 既有草稿/驳回版本）→ 仅 UPDATE doc（+ UPDATE version.published_at，若直发）
	 */
	mode: 'first' | 'update' | 'resubmit'
	/** 提交人 */
	submitterId: number
	submitterName: string
	/** 组 id（update/resubmit 模式取自文档 group_id） */
	groupId: number
	/** 文档 id（first 模式预分配，其他取自既有文档） */
	documentId: bigint
	/** 版本 id（first/update 模式预分配，resubmit 模式取自既有版本） */
	versionId: bigint
	/** 文档标题（first 模式自取，其他传入既有 title） */
	title: string
	/** 规范化扩展名（不含点） — resubmit 模式用于日志拼接，可传既有值 */
	ext: string
	/** 本次版本号，如 'v1.0' / 'v1.1' */
	versionNo: string
	/** 变更说明 — resubmit 模式传 null 即可 */
	changeNote: string | null
	/** 对象存储 key / bucket — resubmit 模式无需 INSERT，可传空串 */
	storageKey: string
	storageBucket: string
	/** 文件大小（字节） — resubmit 模式可传 0 */
	fileSize: number
	/** MIME 类型 — resubmit 模式可传空串 */
	mimeType: string
	/** SHA-256（hex） — resubmit 模式可传空串 */
	checksum: string
}

/**
 * 事务：判定路径 → 写库 → 事务外通知与日志
 *
 * 返回体对应 UploadResult，可直接 ok() 回传给前端
 */
export async function executeUpload(ctx: UploadContext): Promise<UploadResult> {
	const routing = await resolveApprovalPath({
		groupId: BigInt(ctx.groupId),
		submitterId: BigInt(ctx.submitterId),
	})

	const inTx = await prisma.$transaction(async (tx) => {
		// ─── 落 doc_document_versions（first / update 走 INSERT；resubmit 复用既有版本，若直发要补 published_at） ───
		if (ctx.mode === 'first' || ctx.mode === 'update') {
			await tx.doc_document_versions.create({
				data: {
					id: ctx.versionId,
					document_id: ctx.documentId,
					version_no: ctx.versionNo,
					storage_key: ctx.storageKey,
					storage_bucket: ctx.storageBucket,
					file_size: BigInt(ctx.fileSize),
					mime_type: ctx.mimeType,
					checksum: ctx.checksum,
					source_type: 1,
					change_note: ctx.changeNote,
					uploaded_by: BigInt(ctx.submitterId),
					published_at: routing.path === 'direct_publish' ? new Date() : null,
				},
			})
		} else if (routing.path === 'direct_publish') {
			// resubmit 直发布 → 更新既有版本的 published_at（原来多半为 null）
			await tx.doc_document_versions.update({
				where: { id: ctx.versionId },
				data: { published_at: new Date() },
			})
		}

		// ─── 落 doc_documents（first=INSERT / update+resubmit=UPDATE） ───
		if (ctx.mode === 'first') {
			await tx.doc_documents.create({
				data: {
					id: ctx.documentId,
					group_id: BigInt(ctx.groupId),
					owner_user_id: BigInt(ctx.submitterId),
					title: ctx.title,
					ext: ctx.ext,
					status: routing.path === 'direct_publish' ? 4 : 3,
					current_version_id: routing.path === 'direct_publish' ? ctx.versionId : null,
					created_by: BigInt(ctx.submitterId),
					updated_by: BigInt(ctx.submitterId),
				},
			})
		} else {
			await tx.doc_documents.update({
				where: { id: ctx.documentId },
				data: {
					status: routing.path === 'direct_publish' ? 4 : 3,
					current_version_id: routing.path === 'direct_publish' ? ctx.versionId : undefined,
					updated_by: BigInt(ctx.submitterId),
					updated_at: new Date(),
				},
			})
		}

		// ─── 起审批 → 创建 instance + nodes ───
		let approvalInstanceId: bigint | null = null
		if (routing.path === 'approval') {
			approvalInstanceId = generateId()
			await tx.doc_approval_instances.create({
				data: {
					id: approvalInstanceId,
					biz_type: 1,
					biz_id: ctx.versionId,
					document_id: ctx.documentId,
					template_id: routing.templateId,
					mode: 1,
					status: 2,
					initiator_user_id: BigInt(ctx.submitterId),
					current_node_order: 1,
				},
			})
			const nodeRows: Prisma.doc_approval_instance_nodesCreateManyInput[] = routing.nodes.map(n => ({
				id: generateId(),
				instance_id: approvalInstanceId!,
				node_order: n.order,
				approver_user_id: n.approverId,
				action_status: 1,
			}))
			await tx.doc_approval_instance_nodes.createMany({ data: nodeRows })
		}

		return { approvalInstanceId }
	})

	// ─── 事务外：操作日志 ───
	// resubmit 模式不记 DOC_UPLOAD* —— 文件没有变化，只是重新提交审批
	if (ctx.mode !== 'resubmit') {
		const uploadAction = ctx.mode === 'first' ? LOG_ACTIONS.DOC_UPLOAD : LOG_ACTIONS.DOC_UPLOAD_VERSION
		const uploadDesc = ctx.mode === 'first'
			? `上传文件「${ctx.title}」`
			: `上传文件「${ctx.title}」新版本 ${ctx.versionNo}`
		await writeLog({
			actorUserId: ctx.submitterId,
			action: uploadAction,
			targetType: 'document',
			targetId: Number(ctx.documentId),
			groupId: ctx.groupId,
			documentId: Number(ctx.documentId),
			detail: { desc: uploadDesc, versionNo: ctx.versionNo },
		})
	}

	if (routing.path === 'direct_publish') {
		await writeLog({
			actorUserId: ctx.submitterId,
			action: LOG_ACTIONS.DOC_PUBLISH,
			targetType: 'document',
			targetId: Number(ctx.documentId),
			groupId: ctx.groupId,
			documentId: Number(ctx.documentId),
			detail: { desc: `文件「${ctx.title}」发布 ${ctx.versionNo}` },
		})
		await notifyPublishToGroupMembers({
			groupId: ctx.groupId,
			documentId: ctx.documentId,
			title: ctx.title,
			versionNo: ctx.versionNo,
			submitterId: ctx.submitterId,
		})
	} else {
		await writeLog({
			actorUserId: ctx.submitterId,
			action: LOG_ACTIONS.APPROVAL_SUBMIT,
			targetType: 'approval',
			targetId: Number(inTx.approvalInstanceId!),
			groupId: ctx.groupId,
			documentId: Number(ctx.documentId),
			detail: { desc: `提交文件「${ctx.title}」审批` },
		})
		// M1 给第一级非提交人本人的审批人（若第一级恰为提交人本人，跳过；审批推进时会自动通过）
		const firstNonSelf = routing.nodes.find(n => n.approverId !== BigInt(ctx.submitterId))
		if (firstNonSelf) {
			await createNotification(NOTIFICATION_TEMPLATES.M1.build({
				toUserId: firstNonSelf.approverId,
				submitter: ctx.submitterName,
				fileName: ctx.title,
				fileId: ctx.documentId,
			}))
		}
	}

	return {
		documentId: Number(ctx.documentId),
		versionId: Number(ctx.versionId),
		path: routing.path,
		approvalInstanceId: inTx.approvalInstanceId ? Number(inTx.approvalInstanceId) : null,
	}
}

/**
 * 发布通知 M8 — 组内可编辑 + 管理员（去重，不含提交人）
 *
 * PRD §6.8.2 M8：审批通过后发布（或直发布） → 通知归属人 + 可编辑成员 + 组管理员
 * - 归属人即提交人，已在 M3 通道里收过通知（走审批通过时），这里排除避免重复
 * - role 1 管理员 / 2 可编辑
 */
export async function notifyPublishToGroupMembers(params: {
	groupId: number
	documentId: bigint
	title: string
	versionNo: string
	submitterId: number
}): Promise<void> {
	const members = await prisma.doc_group_members.findMany({
		where: {
			group_id: BigInt(params.groupId),
			role: { in: [1, 2] },
			user_id: { not: BigInt(params.submitterId) },
			deleted_at: null,
		},
		select: { user_id: true },
	})
	if (members.length === 0) return
	await createNotifications(members.map(m => NOTIFICATION_TEMPLATES.M8.build({
		toUserId: m.user_id,
		fileName: params.title,
		fileId: params.documentId,
		version: params.versionNo,
	})))
}

/**
 * 版本号自增：vX.Y → vX.(Y+1)
 *
 * - 解析失败时回退到 v1.0（首版兜底）
 * - 不做主版本进位（A 阶段简化）；如需要 v1.9 → v2.0 由后续 UI 手动选择
 */
export function incrementVersion(latest: string | null | undefined): string {
	if (!latest) return 'v1.0'
	const m = latest.match(/^v(\d+)\.(\d+)$/)
	if (!m) return 'v1.0'
	return `v${m[1]}.${Number(m[2]) + 1}`
}
