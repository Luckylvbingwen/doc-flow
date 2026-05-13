/**
 * PUT /api/admin/users/:id/deactivate
 * 停用用户 — status=0，清理组成员资格，交接负责组，移除审批链节点
 * 触发通知：M22（负责组变更）、M23（离职交接 → 部门负责人）、M24（审批链变更 → 组负责人）
 * 鉴权：admin:role_assign（仅 super_admin）
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { hasRole } from '~/server/utils/system-role'
import { SYSTEM_ROLE_CODES } from '~/server/constants/system-roles'
import { createNotification, createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { deactivateUserBodySchema } from '~/server/schemas/admin'
import {
	INVALID_PARAMS,
	USER_NOT_FOUND,
	ADMIN_SUPER_ADMIN_PROTECTED,
	ADMIN_USER_ALREADY_DEACTIVATED,
	ADMIN_SELF_DEACTIVATE,
} from '~/server/constants/error-codes'

const FALLBACK_SUCCESSOR_ID = 10001

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'admin:role_assign')
	if (denied) return denied

	const userIdParam = getRouterParam(event, 'id')
	const userId = Number(userIdParam)
	if (!Number.isFinite(userId) || userId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '用户 ID 无效')
	}

	const operatorId = Number(event.context.user?.id ?? 0)
	const operatorName = event.context.user?.name ?? '管理员'
	if (userId === operatorId) {
		return fail(event, 400, ADMIN_SELF_DEACTIVATE, '不能停用自己的账号')
	}

	const body = await readValidatedBody(event, deactivateUserBodySchema.parse)
	const successorId = body.successorId ?? FALLBACK_SUCCESSOR_ID

	// ── 用户校验 ──
	const targetUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(userId), deleted_at: null },
		select: { id: true, name: true, status: true },
	})
	if (!targetUser) return fail(event, 404, USER_NOT_FOUND, '用户不存在')
	if (targetUser.status === 0) return fail(event, 409, ADMIN_USER_ALREADY_DEACTIVATED, '用户已处于停用状态')

	const isSuperAdmin = await hasRole(userId, SYSTEM_ROLE_CODES.SUPER_ADMIN)
	if (isSuperAdmin) {
		return fail(event, 403, ADMIN_SUPER_ADMIN_PROTECTED, '系统管理员为系统预设，不可停用')
	}

	// ── 接任者校验（指定时） ──
	if (body.successorId) {
		const successor = await prisma.doc_users.findFirst({
			where: { id: BigInt(body.successorId), status: 1, deleted_at: null },
			select: { id: true },
		})
		if (!successor) return fail(event, 400, USER_NOT_FOUND, '指定的接任者不存在或已停用')
	}

	const successorUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(successorId) },
		select: { name: true },
	})
	const successorName = successorUser?.name ?? '系统管理员'

	// ── 预先收集通知所需数据 ──

	// 负责的组
	const ownedGroups = await prisma.doc_groups.findMany({
		where: { owner_user_id: BigInt(userId), deleted_at: null },
		select: { id: true, name: true, scope_type: true, scope_ref_id: true },
	})

	// 各负责组的成员（排除当前用户，事务前收集）
	const ownedGroupMembers: Map<string, bigint[]> = new Map()
	for (const g of ownedGroups) {
		const members = await prisma.doc_group_members.findMany({
			where: { group_id: g.id, user_id: { not: BigInt(userId) } },
			select: { user_id: true },
		})
		ownedGroupMembers.set(g.id.toString(), members.map(m => m.user_id))
	}

	// 审批链节点（获取受影响的 template + group 信息）
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
		// 1. 停用用户
		await tx.doc_users.update({
			where: { id: BigInt(userId) },
			data: { status: 0, updated_at: new Date() },
		})

		// 2. 移除所有组成员资格
		await tx.doc_group_members.deleteMany({
			where: { user_id: BigInt(userId) },
		})

		// 3. 交接负责组
		if (ownedGroups.length > 0) {
			await tx.doc_groups.updateMany({
				where: { owner_user_id: BigInt(userId), deleted_at: null },
				data: { owner_user_id: BigInt(successorId), updated_at: new Date() },
			})
		}

		// 4. 移除审批链节点
		if (affectedTemplateIds.length > 0) {
			await tx.doc_approval_template_nodes.deleteMany({
				where: { approver_user_id: BigInt(userId) },
			})
			// 若节点清空则关闭组审批开关
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

	// M22：负责组变更 — 通知各组成员
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

		// M23：离职交接 — 通知部门负责人（仅部门范围的组）
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

	// M24：审批链成员移除 — 通知各组负责人
	for (const ti of templateInfos) {
		if (!ti.groupOwnerUserId) continue
		await createNotification(NOTIFICATION_TEMPLATES.M24.build({
			toUserId: ti.groupOwnerUserId,
			memberName: targetUser.name,
			groupName: ti.groupName,
			groupId: ti.groupId,
			reason: '用户已停用',
		}))
	}

	// ── 操作日志 ──
	await writeLog({
		actorUserId: operatorId,
		action: LOG_ACTIONS.ADMIN_USER_DEACTIVATE,
		targetType: 'user',
		targetId: userId,
		detail: {
			desc: `${operatorName} 停用了用户「${targetUser.name}」`,
			targetName: targetUser.name,
			ownedGroupsCount: ownedGroups.length,
			approvalChainsAffected: templateInfos.length,
			successorId,
			successorName,
		},
	})

	return ok(null, `用户「${targetUser.name}」已停用`)
})
