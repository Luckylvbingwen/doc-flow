/**
 * POST /api/documents/batch-move
 * 批量跨组移动请求（PRD §6.3.3）
 *
 * Body: { documentIds: number[], targetGroupId: number }
 * 规则：
 *   - 所有文档必须 status=4 已发布，且来自同一源组
 *   - 操作人需对源组有管理权限（doc:move 权限码）
 *   - 目标组不能是当前组
 *   - 目标组不能有同名文件
 *   - 已有待处理移动请求的文档跳过（不阻断整体）
 *   - 为每个文档创建 doc_cross_group_moves 记录
 *   - 合并通知目标组负责人（一条通知涵盖所有文件）
 */
import { prisma } from '~/server/utils/prisma'
import { batchMoveRequestSchema } from '~/server/schemas/cross-move'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { writeLog } from '~/server/utils/operation-log'
import { createNotification } from '~/server/utils/notify'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { generateId } from '~/server/utils/snowflake'
import {
	INVALID_PARAMS,
	GROUP_NOT_FOUND,
	DOCUMENT_DUPLICATE_NAME,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:move')
	if (permErr) return permErr
	const user = event.context.user!

	const body = await readValidatedBody(event, batchMoveRequestSchema.parse)

	// 加载所有文档
	const docs = await prisma.doc_documents.findMany({
		where: {
			id: { in: body.documentIds.map(id => BigInt(id)) },
			deleted_at: null,
		},
		select: {
			id: true, title: true, status: true, group_id: true,
			doc_groups: {
				select: { id: true, name: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
			},
		},
	})

	if (docs.length === 0) {
		return fail(event, 400, INVALID_PARAMS, '未找到有效文档')
	}

	// 校验所有文档来自同一组且状态为已发布
	const sourceGroupIds = new Set(docs.map(d => d.group_id?.toString()).filter(Boolean))
	if (sourceGroupIds.size !== 1) {
		return fail(event, 400, INVALID_PARAMS, '批量移动仅支持同一组内的文档')
	}

	const invalidDocs = docs.filter(d => d.status !== 4)
	if (invalidDocs.length > 0) {
		return fail(event, 400, INVALID_PARAMS, `以下文档未发布不可移动: ${invalidDocs.map(d => d.title).join('、')}`)
	}

	const sourceGroup = docs[0].doc_groups!
	const sourceGroupId = Number(sourceGroup.id)

	// 校验操作人对源组的管理权限
	const groupErr = await requireMemberPermission(event, {
		groupId: sourceGroupId,
		scopeType: sourceGroup.scope_type,
		scopeRefId: sourceGroup.scope_ref_id != null ? Number(sourceGroup.scope_ref_id) : null,
		ownerUserId: Number(sourceGroup.owner_user_id),
	})
	if (groupErr) return groupErr

	// 目标组校验
	if (body.targetGroupId === sourceGroupId) {
		return fail(event, 400, INVALID_PARAMS, '目标组不能与当前组相同')
	}

	const targetGroup = await prisma.doc_groups.findFirst({
		where: { id: BigInt(body.targetGroupId), deleted_at: null },
		select: { id: true, name: true, owner_user_id: true },
	})
	if (!targetGroup) return fail(event, 404, GROUP_NOT_FOUND, '目标组不存在')

	// 同名检测
	const titles = docs.map(d => d.title)
	const duplicates = await prisma.doc_documents.findMany({
		where: { group_id: targetGroup.id, title: { in: titles }, deleted_at: null, status: { not: 6 } },
		select: { title: true },
	})
	if (duplicates.length > 0) {
		const names = duplicates.map(d => d.title).join('、')
		return fail(event, 409, DOCUMENT_DUPLICATE_NAME, `目标组已存在同名文件: ${names}`)
	}

	// 查已有待处理的移动请求
	const pendingMoves = await prisma.doc_cross_group_moves.findMany({
		where: { document_id: { in: docs.map(d => d.id) }, status: 1 },
		select: { document_id: true },
	})
	const pendingDocIds = new Set(pendingMoves.map(m => m.document_id.toString()))

	// 过滤可移动的文档
	const movableDocs = docs.filter(d => !pendingDocIds.has(d.id.toString()))
	if (movableDocs.length === 0) {
		return fail(event, 409, 'MOVE_REQUEST_PENDING', '所有文档均已有待处理的移动请求')
	}

	// 批量创建移动请求
	const now = new Date()
	const moveRecords = movableDocs.map(doc => ({
		id: generateId(),
		document_id: doc.id,
		source_group_id: BigInt(sourceGroupId),
		target_group_id: targetGroup.id,
		status: 1,
		initiated_by: BigInt(user.id),
		created_at: now,
		updated_at: now,
	}))

	await prisma.doc_cross_group_moves.createMany({ data: moveRecords })

	// 日志（每个文档一条）
	for (const doc of movableDocs) {
		await writeLog({
			actorUserId: user.id,
			action: LOG_ACTIONS.DOC_MOVE_REQUEST,
			targetType: 'document',
			targetId: Number(doc.id),
			groupId: sourceGroupId,
			documentId: Number(doc.id),
			detail: {
				desc: `发起将文件「${doc.title}」从「${sourceGroup.name}」移动到「${targetGroup.name}」`,
				fromGroup: sourceGroup.name,
				toGroup: targetGroup.name,
				batch: true,
			},
		})
	}

	// M12 通知目标组负责人（合并为一条通知）
	if (targetGroup.owner_user_id) {
		const fileNames = movableDocs.map(d => d.title).join('、')
		await createNotification(NOTIFICATION_TEMPLATES.M12.build({
			toUserId: targetGroup.owner_user_id,
			initiator: user.name ?? '',
			fileName: movableDocs.length > 1 ? `${fileNames}（共${movableDocs.length}个文件）` : fileNames,
			fromGroup: sourceGroup.name,
			toGroup: targetGroup.name,
			moveIds: moveRecords.map(record => record.id),
		}))
	}

	const skipped = docs.length - movableDocs.length
	const msg = skipped > 0
		? `已为 ${movableDocs.length} 个文件发起移动请求，${skipped} 个已有待处理请求已跳过`
		: `已为 ${movableDocs.length} 个文件发起移动请求，等待目标组负责人确认`

	return ok({ movedCount: movableDocs.length, skippedCount: skipped }, msg)
})
