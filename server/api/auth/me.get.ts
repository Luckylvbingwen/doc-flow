/**
 * GET /api/auth/me
 * 获取当前登录用户信息（含角色与权限码）
 */
import { prisma } from '~/server/utils/prisma'
import type { MeRoleRow as RoleRow } from '~/server/types/auth'

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) {
		return fail(event, 401, 'AUTH_REQUIRED', '请先登录')
	}

	// 查询用户角色（RBAC 表不存在时降级为空角色/权限）
	let roles: RoleRow[] = []
	try {
		roles = await prisma.$queryRaw<RoleRow[]>`
			SELECT r.id, r.code, r.name
			FROM sys_roles r
			JOIN sys_user_roles ur ON ur.role_id = r.id
			WHERE ur.user_id = ${user.id}
			  AND r.status = 1
			  AND r.deleted_at IS NULL
			ORDER BY r.id
		`
	} catch {
		// RBAC 表尚未创建，降级返回
	}

	const isSuperAdmin = roles.some(r => r.code === 'super_admin')

	// 获取权限码
	let permissions: string[]
	if (isSuperAdmin) {
		permissions = await getAllPermissionCodes()
	} else {
		permissions = await getUserPermissions(user.id)
	}

	// 查询头像
	let avatar = ''
	try {
		const rows = await prisma.$queryRawUnsafe<{ avatar_url: string | null }[]>(
			'SELECT avatar_url FROM doc_users WHERE id = ? LIMIT 1', user.id,
		)
		avatar = rows[0]?.avatar_url || ''
	} catch { /* 忽略 */ }

	return ok({
		id: user.id,
		name: user.name,
		email: user.email,
		avatar,
		roles: roles.map(r => ({ id: Number(r.id), code: r.code, name: r.name })),
		permissions
	})
})
