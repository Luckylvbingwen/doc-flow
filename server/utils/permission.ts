/**
 * RBAC 权限工具集
 * - getUserRoleCodes: 获取用户角色标识列表
 * - getUserPermissions: 获取用户全部权限码
 * - requirePermission: 接口级权限校验（无权限返回 403）
 */
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import type { RoleCodeRow, PermissionCodeRow } from '~/server/types/rbac'

/** 获取用户的角色 code 列表 */
export async function getUserRoleCodes(userId: number): Promise<string[]> {
	try {
		const rows = await prisma.$queryRaw<RoleCodeRow[]>`
			SELECT DISTINCT r.code
			FROM sys_roles r
			JOIN sys_user_roles ur ON ur.role_id = r.id
			WHERE ur.user_id = ${userId}
			  AND r.status = 1
			  AND r.deleted_at IS NULL
		`
		return rows.map(r => r.code)
	} catch {
		return []
	}
}

/** 获取用户拥有的权限 code 列表（通过角色聚合） */
export async function getUserPermissions(userId: number): Promise<string[]> {
	try {
		const rows = await prisma.$queryRaw<PermissionCodeRow[]>`
			SELECT DISTINCT p.code
			FROM sys_permissions p
			JOIN sys_role_permissions rp ON rp.permission_id = p.id
			JOIN sys_user_roles ur ON ur.role_id = rp.role_id
			JOIN sys_roles r ON r.id = ur.role_id
			WHERE ur.user_id = ${userId}
			  AND r.status = 1
			  AND r.deleted_at IS NULL
		`
		return rows.map(r => r.code)
	} catch {
		return []
	}
}

/** 获取全部权限码（用于 super_admin 场景） */
export async function getAllPermissionCodes(): Promise<string[]> {
	try {
		const rows = await prisma.$queryRaw<PermissionCodeRow[]>`
			SELECT code FROM sys_permissions ORDER BY sort_order
		`
		return rows.map(r => r.code)
	} catch {
		return []
	}
}

/**
 * 接口级权限校验
 * - 未登录返回 401
 * - super_admin 直接放行
 * - 普通用户校验 code（多个 code 为 OR 关系）
 * - 无权限返回 403
 *
 * 返回 null 表示放行，否则返回需要直接 return 的错误响应
 */
export async function requirePermission(event: H3Event, code: string | string[]) {
	const user = event.context.user
	if (!user) {
		return fail(event, 401, 'AUTH_REQUIRED', '请先登录')
	}

	// super_admin 直接放行
	const roles = await getUserRoleCodes(user.id)
	if (roles.includes('super_admin')) return null

	const userPerms = await getUserPermissions(user.id)
	const codes = Array.isArray(code) ? code : [code]
	const hasAny = codes.some(c => userPerms.includes(c))

	if (!hasAny) {
		return fail(event, 403, 'PERMISSION_DENIED', '无操作权限')
	}

	return null
}
