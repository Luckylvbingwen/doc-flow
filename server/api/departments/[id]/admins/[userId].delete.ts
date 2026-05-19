/**
 * DELETE /api/departments/:id/admins/:userId
 * 移除部门管理员
 */
import { prisma } from '~/server/utils/prisma'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import {
	INVALID_PARAMS,
	DEPARTMENT_NOT_FOUND,
	PERMISSION_DENIED,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const idParam = getRouterParam(event, 'id')
	const deptId = Number(idParam)
	const userIdParam = getRouterParam(event, 'userId')
	const targetUserId = Number(userIdParam)

	if (!Number.isFinite(deptId) || deptId <= 0 || !Number.isFinite(targetUserId) || targetUserId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '参数无效')
	}

	const dept = await prisma.doc_departments.findFirst({
		where: { id: BigInt(deptId), deleted_at: null },
		select: { id: true, name: true, owner_user_id: true },
	})
	if (!dept) return fail(event, 404, DEPARTMENT_NOT_FOUND, '部门不存在')

	// 不能移除部门负责人
	if (dept.owner_user_id && Number(dept.owner_user_id) === targetUserId) {
		return fail(event, 400, INVALID_PARAMS, '不能移除部门负责人')
	}

	// 权限：super_admin 或部门负责人
	const permDenied = await requirePermission(event, 'super_admin')
	const isOwner = dept.owner_user_id && Number(dept.owner_user_id) === user.id
	if (permDenied && !isOwner) {
		return fail(event, 403, PERMISSION_DENIED, '仅系统管理员或部门负责人可移除管理员')
	}

	// 阻塞校验：该管理员是否仍是部门下某组的组负责人
	const ownedGroup = await prisma.doc_groups.findFirst({
		where: {
			scope_type: 2,
			scope_ref_id: BigInt(deptId),
			owner_user_id: BigInt(targetUserId),
			deleted_at: null,
		},
		select: { id: true, name: true },
	})
	if (ownedGroup) {
		return fail(event, 409, INVALID_PARAMS, `该管理员仍是组「${ownedGroup.name}」的负责人，请先移交组负责人后再移除`)
	}

	const deleted = await prisma.doc_department_admins.deleteMany({
		where: {
			department_id: BigInt(deptId),
			user_id: BigInt(targetUserId),
		},
	})

	if (deleted.count === 0) {
		return fail(event, 404, INVALID_PARAMS, '该用户不是部门管理员')
	}

	const targetUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(targetUserId) },
		select: { name: true },
	})

	writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DEPT_ADMIN_REMOVE,
		targetType: 'department',
		targetId: deptId,
		detail: { desc: `移除部门管理员：${targetUser?.name ?? targetUserId}` },
	})

	return ok(null, '移除成功')
})
