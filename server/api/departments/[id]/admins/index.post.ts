/**
 * POST /api/departments/:id/admins
 * 添加部门管理员
 *
 * body: { userId: number }
 */
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import {
	INVALID_PARAMS,
	DEPARTMENT_NOT_FOUND,
	USER_NOT_FOUND,
	PERMISSION_DENIED,
	DEPARTMENT_ADMIN_EXISTS,
} from '~/server/constants/error-codes'

const bodySchema = z.object({
	userId: z.coerce.number().int().positive(),
})

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const idParam = getRouterParam(event, 'id')
	const deptId = Number(idParam)
	if (!Number.isFinite(deptId) || deptId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '部门 ID 无效')
	}

	const body = await readValidatedBody(event, bodySchema.parse)

	const dept = await prisma.doc_departments.findFirst({
		where: { id: BigInt(deptId), deleted_at: null },
		select: { id: true, name: true, owner_user_id: true },
	})
	if (!dept) return fail(event, 404, DEPARTMENT_NOT_FOUND, '部门不存在')

	// 权限：super_admin 或部门负责人
	const permDenied = await requirePermission(event, 'super_admin')
	const isOwner = dept.owner_user_id && Number(dept.owner_user_id) === user.id
	if (permDenied && !isOwner) {
		return fail(event, 403, PERMISSION_DENIED, '仅系统管理员或部门负责人可添加管理员')
	}

	const targetUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(body.userId), deleted_at: null },
		select: { id: true, name: true },
	})
	if (!targetUser) return fail(event, 404, USER_NOT_FOUND, '用户不存在')

	try {
		await prisma.doc_department_admins.create({
			data: {
				id: generateId(),
				department_id: BigInt(deptId),
				user_id: BigInt(body.userId),
				created_by: BigInt(user.id),
			},
		})
	} catch (err) {
		if (isDuplicateKeyError(err)) {
			return fail(event, 409, DEPARTMENT_ADMIN_EXISTS, '该用户已是部门管理员')
		}
		throw err
	}

	writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DEPT_ADMIN_ADD,
		targetType: 'department',
		targetId: deptId,
		detail: { desc: `添加部门管理员：${targetUser.name}` },
	})

	return ok(null, '添加成功')
})
