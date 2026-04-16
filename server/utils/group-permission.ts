/**
 * 文档组操作权限校验
 *
 * 规则:
 *   - super_admin: 全局通过
 *   - 公司层: company_admin 可操作
 *   - 部门层: 该部门的 dept_head 可操作
 *   - 产品线层: 该产品线的 pl_head 可操作
 *   - 组负责人 (owner_user_id): 可操作自己的组
 */
import { prisma } from '~/server/utils/prisma'
import { PERMISSION_DENIED } from '~/server/constants/error-codes'
import type { H3Event } from 'h3'

interface GroupScope {
	scopeType: number
	scopeRefId: number | null
	ownerUserId: number | null
}

/** 校验当前用户是否有权操作指定组 */
export async function requireGroupPermission(
	event: H3Event,
	group: GroupScope,
): Promise<ReturnType<typeof fail> | null> {
	const userId = event.context.user?.id
	if (!userId) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	// 组负责人直接通过
	if (group.ownerUserId && Number(group.ownerUserId) === userId) return null

	// 查询用户角色（含 scope）
	const roles = await prisma.$queryRaw<Array<{
		code: string
		scope_type: number | null
		scope_ref_id: bigint | number | null
	}>>`
		SELECT r.code, ur.scope_type, ur.scope_ref_id
		FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ur.user_id = ${userId}
	`

	// super_admin 全局通过
	if (roles.some(r => r.code === 'super_admin')) return null

	// 按 scope 校验
	const { scopeType, scopeRefId } = group
	const allowed = roles.some((r) => {
		if (scopeType === 1 && r.code === 'company_admin') return true
		if (scopeType === 2 && r.code === 'dept_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		if (scopeType === 3 && r.code === 'pl_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		return false
	})

	if (!allowed) return fail(event, 403, PERMISSION_DENIED, '无操作权限')
	return null
}

/**
 * 校验当前用户是否可在指定 scope 下创建顶级组
 * (创建子组通过 requireGroupPermission 校验父组权限)
 */
export async function requireCreateGroupPermission(
	event: H3Event,
	scopeType: number,
	scopeRefId: number | null,
): Promise<ReturnType<typeof fail> | null> {
	const userId = event.context.user?.id
	if (!userId) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const roles = await prisma.$queryRaw<Array<{
		code: string
		scope_type: number | null
		scope_ref_id: bigint | number | null
	}>>`
		SELECT r.code, ur.scope_type, ur.scope_ref_id
		FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ur.user_id = ${userId}
	`

	if (roles.some(r => r.code === 'super_admin')) return null

	const allowed = roles.some((r) => {
		if (scopeType === 1 && r.code === 'company_admin') return true
		if (scopeType === 2 && r.code === 'dept_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		if (scopeType === 3 && r.code === 'pl_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		return false
	})

	if (!allowed) return fail(event, 403, PERMISSION_DENIED, '无操作权限')
	return null
}
