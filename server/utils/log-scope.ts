/**
 * 操作日志数据范围过滤工具
 *
 * PRD 要求按角色分范围查看日志：
 *   - super_admin / company_admin → 全量
 *   - dept_head → 仅本部门下组的日志
 *   - pl_head → 仅本产品线下组的日志
 *
 * 使用：buildLogScopeFilter(userId) 返回 Prisma.Sql，
 *       直接拼接到 WHERE 子句中（依赖别名 l = doc_operation_logs, g = doc_groups）
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'

export async function buildLogScopeFilter(userId: number): Promise<Prisma.Sql> {
	const userRoles = await prisma.$queryRaw<Array<{
		code: string
		scope_type: number | null
		scope_ref_id: bigint | null
	}>>`
		SELECT r.code, ur.scope_type, ur.scope_ref_id
		FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ur.user_id = ${userId}
	`

	const isSuperOrCompanyAdmin = userRoles.some(
		r => r.code === 'super_admin' || r.code === 'company_admin',
	)
	if (isSuperOrCompanyAdmin) {
		return Prisma.sql`1 = 1`
	}

	// dept_head 管辖的部门 ID
	const deptIds = userRoles
		.filter(r => r.code === 'dept_head' && r.scope_ref_id != null)
		.map(r => BigInt(r.scope_ref_id!))

	// pl_head 管辖的产品线 ID
	const plIds = userRoles
		.filter(r => r.code === 'pl_head' && r.scope_ref_id != null)
		.map(r => BigInt(r.scope_ref_id!))

	// 可见日志范围：自己作为操作者 OR 自己所在组的日志 OR 管辖范围组的日志
	const deptCondition = deptIds.length > 0
		? Prisma.sql`OR (g.scope_type = 2 AND g.scope_ref_id IN (${Prisma.join(deptIds)}))`
		: Prisma.empty

	const plCondition = plIds.length > 0
		? Prisma.sql`OR (g.scope_type = 3 AND g.scope_ref_id IN (${Prisma.join(plIds)}))`
		: Prisma.empty

	return Prisma.sql`(
		l.actor_user_id = ${userId}
		OR l.group_id IN (SELECT group_id FROM doc_group_members WHERE user_id = ${userId} AND deleted_at IS NULL)
		${deptCondition}
		${plCondition}
	)`
}
