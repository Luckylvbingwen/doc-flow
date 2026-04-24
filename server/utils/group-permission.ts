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

export interface GroupScope {
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
 * 布尔版权限判定：当前用户能否在指定组置顶文档
 *
 * 判定规则与 requireMemberPermission 等价（组内 role=1 管理员 / 上游 scope 管理员 / 组负责人 / super_admin），
 * 但只返回 true/false 不走 fail() 响应，适用于读端接口回填 canPin 字段。
 *
 * groupId 为空（草稿未归组）→ false
 */
export async function canUserPinInGroup(
	userId: number,
	groupId: number | bigint | null,
): Promise<boolean> {
	if (groupId == null) return false

	// 1) 组内管理员（role=1）
	const memberRole = await prisma.doc_group_members.findFirst({
		where: {
			group_id: BigInt(groupId),
			user_id: BigInt(userId),
			role: 1,
			deleted_at: null,
		},
		select: { id: true },
	})
	if (memberRole) return true

	// 2) 组负责人 / scope 上游管理员：拉组 meta + 角色表复用 requireGroupPermission 的判定
	const group = await prisma.doc_groups.findUnique({
		where: { id: BigInt(groupId) },
		select: { scope_type: true, scope_ref_id: true, owner_user_id: true, deleted_at: true },
	})
	if (!group || group.deleted_at) return false

	if (group.owner_user_id && Number(group.owner_user_id) === userId) return true

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

	if (roles.some(r => r.code === 'super_admin')) return true

	const scopeType = group.scope_type
	const scopeRefId = group.scope_ref_id
	return roles.some((r) => {
		if (scopeType === 1 && r.code === 'company_admin') return true
		if (scopeType === 2 && r.code === 'dept_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		if (scopeType === 3 && r.code === 'pl_head'
			&& Number(r.scope_ref_id) === Number(scopeRefId)) return true
		return false
	})
}

/**
 * 校验当前用户是否有权管理指定组的成员
 * 在 requireGroupPermission 基础上，增加：组内 role=1（管理员）也可管理成员
 * 注意：先查组内管理员身份，再回落到 scope 校验，避免 fail() 预设状态码后被反转
 */
export async function requireMemberPermission(
	event: H3Event,
	group: GroupScope & { groupId: number },
): Promise<ReturnType<typeof fail> | null> {
	const userId = event.context.user?.id
	if (!userId) return fail(event, 401, 'AUTH_REQUIRED', '请先登录')

	const memberRole = await prisma.doc_group_members.findFirst({
		where: {
			group_id: BigInt(group.groupId),
			user_id: BigInt(userId),
			role: 1,
			deleted_at: null,
		},
		select: { id: true },
	})

	if (memberRole) return null

	return requireGroupPermission(event, group)
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
