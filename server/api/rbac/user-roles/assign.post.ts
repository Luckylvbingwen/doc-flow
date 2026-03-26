/**
 * POST /api/rbac/user-roles/assign
 * 为用户分配角色
 */
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:assign')
	if (denied) return denied

	const body = await readBody<{
		userId?: number
		roleId?: number
	}>(event)

	const userId = Number(body.userId)
	const roleId = Number(body.roleId)

	if (!userId || !roleId) {
		return fail(event, 400, 'INVALID_PARAMS', '用户 ID 和角色 ID 不能为空')
	}

	// 验证用户存在
	const userCheck = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
		SELECT COUNT(*) as cnt FROM doc_users
		WHERE id = ${userId} AND deleted_at IS NULL
	`
	if (Number(userCheck[0]?.cnt) === 0) {
		return fail(event, 404, 'USER_NOT_FOUND', '用户不存在')
	}

	// 验证角色存在
	const roleCheck = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
		SELECT COUNT(*) as cnt FROM sys_roles
		WHERE id = ${roleId} AND deleted_at IS NULL AND status = 1
	`
	if (Number(roleCheck[0]?.cnt) === 0) {
		return fail(event, 404, 'ROLE_NOT_FOUND', '角色不存在或已停用')
	}

	// 检查是否已分配
	const existCheck = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
		SELECT COUNT(*) as cnt FROM sys_user_roles
		WHERE user_id = ${userId} AND role_id = ${roleId}
	`
	if (Number(existCheck[0]?.cnt) > 0) {
		return fail(event, 409, 'ALREADY_ASSIGNED', '该用户已拥有此角色')
	}

	const createdBy = event.context.user?.id ?? null

	await prisma.$executeRaw`
		INSERT INTO sys_user_roles (user_id, role_id, created_by)
		VALUES (${userId}, ${roleId}, ${createdBy})
	`

	return ok(null, '角色分配成功')
})
