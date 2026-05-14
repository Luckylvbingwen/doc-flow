/**
 * POST /api/groups/:id/transfer-leader
 * 组负责人交接（PRD §6.3.2）
 * - 仅组负责人或系统管理员可操作
 * - 原负责人降为普通成员，新负责人获管理权
 * - 通知三方（原负责人、新负责人、系统管理员）
 */
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { writeLogs } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { GROUP_NOT_FOUND, INVALID_PARAMS, PERMISSION_DENIED } from '~/server/constants/error-codes'

const bodySchema = z.object({
	newLeaderUserId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'group:update')
	if (permErr) return permErr

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const body = await readValidatedBody(event, bodySchema.parse)
	const userId = event.context.user!.id

	// 查询组信息
	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true, name: true, owner_user_id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const currentOwnerId = Number(group.owner_user_id)

	// 权限：仅组负责人或系统管理员
	const isSuperAdmin = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
		SELECT COUNT(*) as cnt FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ur.user_id = ${userId} AND r.code = 'super_admin'
	`.then(rows => Number(rows[0]?.cnt) > 0)

	if (currentOwnerId !== userId && !isSuperAdmin) {
		return fail(event, 403, PERMISSION_DENIED, '仅组负责人或系统管理员可交接')
	}

	// 不能交接给自己
	if (body.newLeaderUserId === currentOwnerId) {
		return fail(event, 400, INVALID_PARAMS, '新负责人不能是当前负责人')
	}

	// 验证新负责人存在
	const newLeader = await prisma.doc_users.findFirst({
		where: { id: BigInt(body.newLeaderUserId), status: 1 },
		select: { id: true, name: true },
	})
	if (!newLeader) return fail(event, 400, INVALID_PARAMS, '目标用户不存在或已停用')

	const oldOwner = await prisma.doc_users.findFirst({
		where: { id: BigInt(currentOwnerId) },
		select: { name: true },
	})
	const oldOwnerName = oldOwner?.name ?? '未知用户'
	const newOwnerName = newLeader.name

	// 事务：更新负责人 + 成员角色调整
	await prisma.$transaction(async (tx) => {
		// 1. 更新组负责人
		await tx.doc_groups.update({
			where: { id: BigInt(id) },
			data: { owner_user_id: BigInt(body.newLeaderUserId), updated_at: new Date() },
		})

		// 2. 原负责人：如果在成员列表中且角色是管理员，降为可编辑(2)
		await tx.doc_group_members.updateMany({
			where: {
				group_id: BigInt(id),
				user_id: BigInt(currentOwnerId),
				deleted_at: null,
			},
			data: { role: 2, updated_at: new Date() },
		})

		// 3. 新负责人：确保在成员列表中且为管理员(1)
		const existingMember = await tx.doc_group_members.findFirst({
			where: { group_id: BigInt(id), user_id: BigInt(body.newLeaderUserId), deleted_at: null },
			select: { id: true },
		})
		if (existingMember) {
			await tx.doc_group_members.update({
				where: { id: existingMember.id },
				data: { role: 1, updated_at: new Date() },
			})
		} else {
			await tx.doc_group_members.create({
				data: {
					id: generateId(),
					group_id: BigInt(id),
					user_id: BigInt(body.newLeaderUserId),
					role: 1,
					source_type: 1,
					immutable_flag: 0,
					created_by: BigInt(userId),
				},
			})
		}
	})

	// 获取所有系统管理员 ID（用于通知）
	const superAdmins = await prisma.$queryRaw<Array<{ user_id: bigint }>>`
		SELECT ur.user_id FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE r.code = 'super_admin'
	`

	// M22 通知：原负责人、新负责人、系统管理员
	const notifyUserIds = new Set<number>([currentOwnerId, body.newLeaderUserId])
	for (const sa of superAdmins) notifyUserIds.add(Number(sa.user_id))

	await createNotifications(
		Array.from(notifyUserIds).map(uid =>
			NOTIFICATION_TEMPLATES.M22.build({
				toUserId: uid,
				groupName: group.name,
				groupId: id,
				oldOwner: oldOwnerName,
				newOwner: newOwnerName,
			})
		)
	)

	// 操作日志
	await writeLogs([{
		actorUserId: userId,
		action: LOG_ACTIONS.GROUP_LEADER_TRANSFER,
		targetType: 'group',
		targetId: id,
		groupId: id,
		detail: {
			desc: `组「${group.name}」负责人由 ${oldOwnerName} 交接给 ${newOwnerName}`,
			oldOwnerId: currentOwnerId,
			newOwnerId: body.newLeaderUserId,
		},
	}])

	return ok(null, `已将组「${group.name}」负责人交接给 ${newOwnerName}`)
})
