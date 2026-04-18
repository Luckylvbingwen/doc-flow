/**
 * 回收站数据范围过滤工具
 *
 * 范围规则（与列表接口一致）：
 *   super_admin / company_admin → 全站
 *   dept_head                   → 本部门下的组
 *   pl_head                     → 本产品线下的组
 *   其他用户                    → 自己删的 + 自己加入组里的
 *
 * 使用：buildRecycleScopeFilter(userId) 返回 Prisma.Sql，
 *       直接拼接到 WHERE 子句中（依赖别名 d = doc_documents）
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'

interface RoleScopeRow {
	code: string
	scope_type: number | null
	scope_ref_id: bigint | null
}

export async function buildRecycleScopeFilter(userId: number): Promise<Prisma.Sql> {
	const roleRows = await prisma.$queryRaw<RoleScopeRow[]>`
		SELECT r.code, ur.scope_type, ur.scope_ref_id
		FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id
		WHERE ur.user_id = ${userId}
		  AND r.status = 1
		  AND r.deleted_at IS NULL
	`
	const roleCodes = new Set(roleRows.map(r => r.code))
	if (roleCodes.has('super_admin') || roleCodes.has('company_admin')) {
		return Prisma.sql`1 = 1`
	}

	const orConds: Prisma.Sql[] = [
		Prisma.sql`d.deleted_by_user_id = ${userId}`,
		Prisma.sql`d.group_id IN (
			SELECT m.group_id FROM doc_group_members m
			WHERE m.user_id = ${userId} AND m.deleted_at IS NULL
		)`,
	]

	// dept_head：sys_user_roles.scope_type=1 → doc_groups.scope_type=2
	const deptIds = roleRows
		.filter(r => r.code === 'dept_head' && r.scope_type === 1 && r.scope_ref_id != null)
		.map(r => Number(r.scope_ref_id))
	if (deptIds.length > 0) {
		orConds.push(Prisma.sql`d.group_id IN (
			SELECT id FROM doc_groups
			WHERE scope_type = 2 AND scope_ref_id IN (${Prisma.join(deptIds)}) AND deleted_at IS NULL
		)`)
	}

	// pl_head：sys_user_roles.scope_type=2 → doc_groups.scope_type=3
	const plIds = roleRows
		.filter(r => r.code === 'pl_head' && r.scope_type === 2 && r.scope_ref_id != null)
		.map(r => Number(r.scope_ref_id))
	if (plIds.length > 0) {
		orConds.push(Prisma.sql`d.group_id IN (
			SELECT id FROM doc_groups
			WHERE scope_type = 3 AND scope_ref_id IN (${Prisma.join(plIds)}) AND deleted_at IS NULL
		)`)
	}

	return Prisma.sql`(${Prisma.join(orConds, ' OR ')})`
}
