/**
 * 用户停用核心逻辑
 *
 * 从 `admin/users/[id]/deactivate.put.ts` 抽离的可复用交接逻辑，
 * 供 API 停用 和 飞书离职 Webhook 共用。
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { hasRole } from '~/server/utils/system-role'
import { SYSTEM_ROLE_CODES } from '~/server/constants/system-roles'
import { createNotification, createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'

const FALLBACK_SUCCESSOR_ID = 10001

export interface DeactivateUserOpts {
	/** 被停用的用户 ID */
	userId: number
	/** 接任者 ID（不传则使用 FALLBACK_SUCCESSOR_ID） */
	successorId?: number
	/** 操作人 ID（Webhook 场景为 0 表示系统） */
	operatorId: number
	/** 操作人名称 */
	operatorName: string
	/** 触发来源（用于日志区分） */
	source: 'admin' | 'feishu_webhook'
}

export interface DeactivateUserResult {
	success: boolean
	message: string
	/** 被停用用户的名称 */
	userName?: string
	/** 跳过原因（如用户不存在、已停用、系统管理员等） */
	skipReason?: string
}

/**
 * 执行用户停用 + 组交接 + 审批链清理 + 通知
 * 可重入：已停用的用户会被跳过（返回 skipReason）
 */
export async function deactivateUser(opts: DeactivateUserOpts): Promise<DeactivateUserResult> {
	const { userId, operatorId, operatorName, source } = opts
	const successorId = opts.successorId ?? FALLBACK_SUCCESSOR_ID

	// ── 用户校验 ──
	const targetUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(userId), deleted_at: null },
		select: { id: true, name: true, status: true },
	})
	if (!targetUser) {
		return { success: false, message: '用户不存在', skipReason: 'not_found' }
	}
	if (targetUser.status === 0) {
		return { success: false, message: '用户已处于停用状态', skipReason: 'already_deactivated' }
	}

	const isSuperAdmin = await hasRole(userId, SYSTEM_ROLE_CODES.SUPER_ADMIN)
	if (isSuperAdmin) {
		return { success: false, message: '系统管理员不可停用', skipReason: 'super_admin' }
	}

	// ── 接任者校验 ──
	if (opts.successorId) {
		const successor = await prisma.doc_users.findFirst({
			where: { id: BigInt(opts.successorId), status: 1, deleted_at: null },
			select: { id: true },
		})
		if (!successor) {
			return { success: false, message: '指定的接任者不存在或已停用', skipReason: 'successor_invalid' }
		}
	}

	const successorUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(successorId) },
		select: { name: true },
	})
	const successorName = successorUser?.name ?? '系统管理员'

	// ── 预先收集通知所需数据 ──
	const ownedGroups = await prisma.doc_groups.findMany({
		where: { owner_user_id: BigInt(userId), deleted_at: null },
		select: { id: true, name: true, scope_type: true, scope_ref_id: true },
	})

	const ownedGroupMembers: Map<string, bigint[]> = new Map()
	for (const g of ownedGroups) {
		const members = await prisma.doc_group_members.findMany({
			where: { group_id: g.id, user_id: { not: BigInt(userId) } },
			select: { user_id: true },
		})
		ownedGroupMembers.set(g.id.toString(), members.map(m => m.user_id))
	}

	const affectedNodes = await prisma.doc_approval_template_nodes.findMany({
		where: { approver_user_id: BigInt(userId) },
		select: { template_id: true },
	})
	const affectedTemplateIds = [...new Set(affectedNodes.map(n => n.template_id.toString()))].map(BigInt)

	interface TemplateInfo {
		id: bigint
		groupId: bigint
		groupName: string
		groupOwnerUserId: bigint | null
		approvalEnabled: number
		willBeEmpty: boolean
	}
	const templateInfos: TemplateInfo[] = []
	for (const tplId of affectedTemplateIds) {
		const tpl = await prisma.doc_approval_templates.findFirst({
			where: { id: tplId, deleted_at: null },
			select: { id: true, group_id: true },
		})
		if (!tpl) continue
		const group = await prisma.doc_groups.findFirst({
			where: { id: tpl.group_id },
			select: { name: true, owner_user_id: true, approval_enabled: true },
		})
		if (!group) continue
		const totalNodes = await prisma.doc_approval_template_nodes.count({ where: { template_id: tplId } })
		const userNodes = await prisma.doc_approval_template_nodes.count({
			where: { template_id: tplId, approver_user_id: BigInt(userId) },
		})
		templateInfos.push({
			id: tplId,
			groupId: tpl.group_id,
			groupName: group.name,
			groupOwnerUserId: group.owner_user_id,
			approvalEnabled: group.approval_enabled,
			willBeEmpty: totalNodes === userNodes,
		})
	}

	// ── 事务：停用 + 清理 ──
	await prisma.$transaction(async (tx) => {
		await tx.doc_users.update({
			where: { id: BigInt(userId) },
			data: { status: 0, updated_at: new Date() },
		})
		await tx.doc_group_members.deleteMany({
			where: { user_id: BigInt(userId) },
		})
		if (ownedGroups.length > 0) {
			await tx.doc_groups.updateMany({
				where: { owner_user_id: BigInt(userId), deleted_at: null },
				data: { owner_user_id: BigInt(successorId), updated_at: new Date() },
			})
		}
		if (affectedTemplateIds.length > 0) {
			await tx.doc_approval_template_nodes.deleteMany({
				where: { approver_user_id: BigInt(userId) },
			})
			for (const ti of templateInfos) {
				if (ti.willBeEmpty && ti.approvalEnabled === 1) {
					await tx.doc_groups.update({
						where: { id: ti.groupId },
						data: { approval_enabled: 0, updated_at: new Date() },
					})
				}
			}
		}
	})

	// ── 事务后通知 ──
	for (const g of ownedGroups) {
		const memberIds = ownedGroupMembers.get(g.id.toString()) ?? []
		if (memberIds.length > 0) {
			await createNotifications(
				memberIds.map(toUserId => NOTIFICATION_TEMPLATES.M22.build({
					toUserId,
					groupName: g.name,
					groupId: g.id,
					oldOwner: targetUser.name,
					newOwner: successorName,
				})),
			)
		}
		if (g.scope_type === 2 && g.scope_ref_id) {
			const dept = await prisma.doc_departments.findFirst({
				where: { id: g.scope_ref_id },
				select: { owner_user_id: true },
			})
			if (dept?.owner_user_id && Number(dept.owner_user_id) !== userId) {
				await createNotification(NOTIFICATION_TEMPLATES.M23.build({
					toUserId: dept.owner_user_id,
					leaver: targetUser.name,
					groupName: g.name,
					groupId: g.id,
					successor: successorName,
				}))
			}
		}
	}
	for (const ti of templateInfos) {
		if (!ti.groupOwnerUserId) continue
		await createNotification(NOTIFICATION_TEMPLATES.M24.build({
			toUserId: ti.groupOwnerUserId,
			memberName: targetUser.name,
			groupName: ti.groupName,
			groupId: ti.groupId,
			reason: source === 'feishu_webhook' ? '飞书人事离职' : '用户已停用',
		}))
	}

	// ── 操作日志 ──
	await writeLog({
		actorUserId: operatorId,
		action: LOG_ACTIONS.ADMIN_USER_DEACTIVATE,
		targetType: 'user',
		targetId: userId,
		detail: {
			desc: source === 'feishu_webhook'
				? `飞书人事事件自动停用用户「${targetUser.name}」`
				: `${operatorName} 停用了用户「${targetUser.name}」`,
			targetName: targetUser.name,
			ownedGroupsCount: ownedGroups.length,
			approvalChainsAffected: templateInfos.length,
			successorId,
			successorName,
			source,
		},
	})

	return {
		success: true,
		message: `用户「${targetUser.name}」已停用`,
		userName: targetUser.name,
	}
}
