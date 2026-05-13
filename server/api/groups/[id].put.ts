/**
 * PUT /api/groups/:id
 * 编辑组（名称、描述）
 */
import { prisma } from '~/server/utils/prisma'
import { requireGroupPermission } from '~/server/utils/group-permission'
import { groupUpdateSchema } from '~/server/schemas/group'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import { GROUP_NOT_FOUND, GROUP_NAME_EXISTS, INVALID_PARAMS, USER_NOT_FOUND } from '~/server/constants/error-codes'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const body = await readValidatedBody(event, groupUpdateSchema.parse)
	if (!body.name && body.description === undefined && body.ownerId === undefined) {
		return fail(event, 400, INVALID_PARAMS, '至少提供一个修改字段')
	}

	// 校验组存在 + 权限
	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true, name: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireGroupPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
	})
	if (denied) return denied

	// 构建更新数据
	const data: Record<string, unknown> = {}
	if (body.name) data.name = body.name.trim()
	if (body.description !== undefined) data.description = body.description?.trim() || null

	// 负责人变更逻辑
	let ownerChanged = false
	let oldOwnerName = ''
	let newOwnerName = ''
	if (body.ownerId !== undefined && body.ownerId !== Number(group.owner_user_id)) {
		const newOwner = await prisma.doc_users.findFirst({
			where: { id: BigInt(body.ownerId), deleted_at: null },
			select: { id: true, name: true },
		})
		if (!newOwner) return fail(event, 404, USER_NOT_FOUND, '新负责人用户不存在')

		const oldOwner = await prisma.doc_users.findFirst({
			where: { id: group.owner_user_id, deleted_at: null },
			select: { name: true },
		})

		data.owner_user_id = BigInt(body.ownerId)
		ownerChanged = true
		oldOwnerName = oldOwner?.name ?? ''
		newOwnerName = newOwner.name
	}

	try {
		await prisma.doc_groups.update({
			where: { id: BigInt(id) },
			data,
		})
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, GROUP_NAME_EXISTS, '同级下已存在同名组')
		}
		throw error
	}

	await writeLog({
		actorUserId: event.context.user!.id,
		action: LOG_ACTIONS.GROUP_UPDATE,
		targetType: 'group',
		targetId: id,
		groupId: id,
		detail: {
			desc: `编辑组「${body.name?.trim() || group.name}」信息`,
			changes: data,
		},
	})

	// M22 通知：负责人变更 → 通知所有组成员
	if (ownerChanged) {
		const members = await prisma.$queryRaw<Array<{ user_id: bigint }>>`
			SELECT user_id FROM doc_group_members
			WHERE group_id = ${BigInt(id)} AND deleted_at IS NULL
		`
		const groupName = (body.name?.trim()) || group.name
		const notifyList = members.map(m => NOTIFICATION_TEMPLATES.M22.build({
			toUserId: m.user_id,
			groupName,
			groupId: BigInt(id),
			oldOwner: oldOwnerName,
			newOwner: newOwnerName,
		}))
		if (notifyList.length > 0) await createNotifications(notifyList)
	}

	return ok(null, '组更新成功')
})
