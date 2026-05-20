import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { createNotification } from '~/server/utils/notify'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { generateId } from '~/server/utils/snowflake'

export interface FeishuActionActor {
	id: number
	name: string
}

export async function executeOwnershipTransferAction(opts: {
	documentId: bigint | number
	actor: FeishuActionActor
	action: 'accept' | 'reject'
}): Promise<{ message: string; resultLabel: string }> {
	const docId = BigInt(opts.documentId)
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, owner_user_id: true, group_id: true },
	})
	if (!doc) throw new Error('文档不存在')

	const transfer = await prisma.doc_ownership_transfers.findFirst({
		where: { document_id: docId, status: 1 },
		orderBy: { created_at: 'desc' },
	})
	if (!transfer) throw new Error('没有待处理的转移请求')
	if (Number(transfer.to_user_id) !== opts.actor.id) throw new Error('只有目标接收人可处理此请求')

	if (transfer.expires_at < new Date()) {
		await prisma.doc_ownership_transfers.update({
			where: { id: transfer.id },
			data: { status: 4, processed_at: new Date() },
		})
		await createNotification(
			NOTIFICATION_TEMPLATES.M11.build({
				toUserId: Number(transfer.from_user_id),
				fileName: doc.title,
				result: '已过期',
			}),
		)
		throw new Error('该转移请求已过期')
	}

	const now = new Date()
	if (opts.action === 'accept') {
		await prisma.$transaction([
			prisma.doc_ownership_transfers.update({
				where: { id: transfer.id },
				data: { status: 2, processed_at: now },
			}),
			prisma.doc_documents.update({
				where: { id: docId },
				data: { owner_user_id: transfer.to_user_id },
			}),
		])

		await Promise.all([
			createNotification(
				NOTIFICATION_TEMPLATES.M11.build({
					toUserId: Number(transfer.from_user_id),
					fileName: doc.title,
					result: '已同意',
				}),
			),
			createNotification(
				NOTIFICATION_TEMPLATES.M11.build({
					toUserId: opts.actor.id,
					fileName: doc.title,
					result: '已同意',
				}),
			),
		])

		await writeLog({
			actorUserId: opts.actor.id,
			action: LOG_ACTIONS.OWNERSHIP_APPROVE,
			targetType: 'document',
			targetId: Number(docId),
			groupId: doc.group_id ? Number(doc.group_id) : undefined,
			documentId: Number(docId),
			detail: {
				desc: `同意了「${opts.actor.name}」的归属人转移请求，已成为文档归属人`,
				fromUserId: Number(transfer.from_user_id),
			},
		})

		return { message: '已同意，归属权已转移', resultLabel: '已同意' }
	}

	await prisma.doc_ownership_transfers.update({
		where: { id: transfer.id },
		data: { status: 3, processed_at: now },
	})

	await createNotification(
		NOTIFICATION_TEMPLATES.M11.build({
			toUserId: Number(transfer.from_user_id),
			fileName: doc.title,
			result: '已拒绝',
		}),
	)

	await writeLog({
		actorUserId: opts.actor.id,
		action: LOG_ACTIONS.OWNERSHIP_REJECT,
		targetType: 'document',
		targetId: Number(docId),
		groupId: doc.group_id ? Number(doc.group_id) : undefined,
		documentId: Number(docId),
		detail: {
			desc: '拒绝了归属人转移请求',
			fromUserId: Number(transfer.from_user_id),
		},
	})

	return { message: '已拒绝转移请求', resultLabel: '已拒绝' }
}

async function executeSingleCrossMoveAction(opts: {
	moveId: bigint | number
	actor: FeishuActionActor
	action: 'approve' | 'reject'
}): Promise<void> {
	const moveId = BigInt(opts.moveId)
	const move = await prisma.doc_cross_group_moves.findUnique({
		where: { id: moveId },
		include: {
			doc_documents: { select: { id: true, title: true, status: true, deleted_at: true } },
			doc_groups_doc_cross_group_moves_source_group_idTodoc_groups: { select: { name: true } },
			doc_groups_doc_cross_group_moves_target_group_idTodoc_groups: { select: { id: true, name: true, owner_user_id: true } },
			doc_users: { select: { id: true, name: true } },
		},
	})
	if (!move) throw new Error('移动请求不存在')
	if (move.status !== 1) throw new Error('该请求已被处理')

	const targetGroup = move.doc_groups_doc_cross_group_moves_target_group_idTodoc_groups
	const sourceGroupName = move.doc_groups_doc_cross_group_moves_source_group_idTodoc_groups?.name ?? ''
	const doc = move.doc_documents
	const initiator = move.doc_users
	if (!targetGroup || !doc || !initiator) throw new Error('移动请求数据不完整')

	const isTargetOwner = Number(targetGroup.owner_user_id) === opts.actor.id
	const roles = await prisma.$queryRaw<Array<{ code: string }>>`
		SELECT r.code FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ur.user_id = ${opts.actor.id}
	`
	const isSuperAdmin = roles.some(r => r.code === 'super_admin')
	if (!isTargetOwner && !isSuperAdmin) throw new Error('仅目标组负责人可审核此请求')

	const now = new Date()
	if (opts.action === 'approve') {
		if (doc.deleted_at || doc.status !== 4) throw new Error('文档已被删除或状态已变更，无法移动')

		await prisma.$transaction(async (tx) => {
			await tx.doc_cross_group_moves.update({
				where: { id: moveId },
				data: { status: 2, reviewed_by: BigInt(opts.actor.id), reviewed_at: now, updated_at: now },
			})
			await tx.doc_documents.update({
				where: { id: doc.id },
				data: { group_id: targetGroup.id, updated_at: now, updated_by: BigInt(opts.actor.id) },
			})
		})

		await writeLog({
			actorUserId: opts.actor.id,
			action: LOG_ACTIONS.DOC_MOVE_APPROVE,
			targetType: 'document',
			targetId: Number(doc.id),
			groupId: Number(targetGroup.id),
			documentId: Number(doc.id),
			detail: {
				desc: `同意将文件「${doc.title}」从「${sourceGroupName}」移动到「${targetGroup.name}」`,
				moveId: Number(moveId),
			},
		})

		await createNotification(NOTIFICATION_TEMPLATES.M13.build({
			toUserId: initiator.id,
			fileName: doc.title,
			result: '已同意',
		}))
		return
	}

	await prisma.doc_cross_group_moves.update({
		where: { id: moveId },
		data: { status: 3, reviewed_by: BigInt(opts.actor.id), reviewed_at: now, updated_at: now },
	})

	await writeLog({
		actorUserId: opts.actor.id,
		action: LOG_ACTIONS.DOC_MOVE_REJECT,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: Number(move.source_group_id),
		documentId: Number(doc.id),
		detail: {
			desc: `拒绝将文件「${doc.title}」移动到「${targetGroup.name}」`,
			moveId: Number(moveId),
		},
	})

	await createNotification(NOTIFICATION_TEMPLATES.M13.build({
		toUserId: initiator.id,
		fileName: doc.title,
		result: '已拒绝',
	}))
}

export async function executeCrossMoveAction(opts: {
	moveIds: Array<bigint | number>
	actor: FeishuActionActor
	action: 'approve' | 'reject'
}): Promise<{ message: string; resultLabel: string }> {
	if (opts.moveIds.length === 0) throw new Error('缺少移动请求 ID')
	for (const moveId of opts.moveIds) {
		await executeSingleCrossMoveAction({ moveId, actor: opts.actor, action: opts.action })
	}
	const count = opts.moveIds.length
	const actionLabel = opts.action === 'approve' ? '同意' : '拒绝'
	return {
		message: count === 1 ? `已${actionLabel}移动请求` : `已${actionLabel} ${count} 个移动请求`,
		resultLabel: `已${actionLabel}`,
	}
}

export async function executePermissionRequestAction(opts: {
	documentId: bigint | number
	requestId: bigint | number
	actor: FeishuActionActor
	action: 'approve' | 'reject'
}): Promise<{ message: string; resultLabel: string }> {
	const docId = BigInt(opts.documentId)
	const reqId = BigInt(opts.requestId)
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, owner_user_id: true, group_id: true },
	})
	if (!doc) throw new Error('文档不存在')
	if (Number(doc.owner_user_id) !== opts.actor.id) throw new Error('仅文档归属人可处理权限申请')

	const req = await prisma.doc_permission_requests.findFirst({
		where: { id: reqId, document_id: docId },
		include: {
			doc_users_doc_permission_requests_user_idTodoc_users: { select: { id: true, name: true } },
		},
	})
	if (!req) throw new Error('申请记录不存在')
	if (req.status !== 1) throw new Error('该申请已被处理')

	const applicantId = req.user_id
	const applicantName = req.doc_users_doc_permission_requests_user_idTodoc_users?.name ?? ''
	const permType = req.type === 1 ? '阅读' : '编辑'
	const now = new Date()

	if (opts.action === 'approve') {
		const targetPermission = req.type === 1 ? 4 : 2
		const existing = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: applicantId, deleted_at: null },
			select: { id: true, permission: true },
		})

		await prisma.$transaction(async (tx) => {
			await tx.doc_permission_requests.update({
				where: { id: reqId },
				data: { status: 2, reviewed_by: BigInt(opts.actor.id), reviewed_at: now },
			})

			if (existing) {
				await tx.doc_document_permissions.update({
					where: { id: existing.id },
					data: { permission: targetPermission, updated_at: now },
				})
			} else {
				await tx.doc_document_permissions.create({
					data: {
						id: BigInt(generateId()),
						document_id: docId,
						user_id: applicantId,
						permission: targetPermission,
						granted_by: BigInt(opts.actor.id),
						created_at: now,
						updated_at: now,
					},
				})
			}
		})

		await createNotification(
			NOTIFICATION_TEMPLATES.M16.build({
				toUserId: Number(applicantId),
				fileName: doc.title,
				permType: permType as '阅读' | '编辑',
				result: '已同意',
			}),
		)

		await writeLog({
			actorUserId: opts.actor.id,
			action: LOG_ACTIONS.PERMISSION_REQ_APPROVE,
			targetType: 'document',
			targetId: Number(docId),
			groupId: doc.group_id ? Number(doc.group_id) : undefined,
			documentId: Number(docId),
			detail: {
				desc: `同意了「${applicantName}」的${permType}权限申请`,
				applicantId: Number(applicantId),
			},
		})

		return { message: '已同意申请', resultLabel: '已同意' }
	}

	await prisma.doc_permission_requests.update({
		where: { id: reqId },
		data: { status: 3, reviewed_by: BigInt(opts.actor.id), reviewed_at: now },
	})

	await createNotification(
		NOTIFICATION_TEMPLATES.M16.build({
			toUserId: Number(applicantId),
			fileName: doc.title,
			permType: permType as '阅读' | '编辑',
			result: '已拒绝',
		}),
	)

	await writeLog({
		actorUserId: opts.actor.id,
		action: LOG_ACTIONS.PERMISSION_REQ_REJECT,
		targetType: 'document',
		targetId: Number(docId),
		groupId: doc.group_id ? Number(doc.group_id) : undefined,
		documentId: Number(docId),
		detail: {
			desc: `拒绝了「${applicantName}」的${permType}权限申请`,
			applicantId: Number(applicantId),
		},
	})

	return { message: '已拒绝申请', resultLabel: '已拒绝' }
}
