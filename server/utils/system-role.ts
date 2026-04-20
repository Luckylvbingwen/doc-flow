/**
 * 系统角色管理 helper（§6.9 / §4.1）
 *
 * 统一维护 sys_user_roles 的增删，供：
 *   - /api/admin/users/:id/roles  批量指派（PUT）
 *   - /api/product-lines POST/PUT 事务内自动授予 pl_head
 *
 * 幂等约束：sys_user_roles 有 UNIQUE KEY (user_id, role_id, scope_type, scope_ref_id)
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import type { SystemRoleCode } from '~/server/constants/system-roles'

/**
 * 查 role.id by code（带简单进程内缓存，角色表几乎不变）
 */
const roleIdCache = new Map<string, bigint>()

export async function getRoleIdByCode(
	code: SystemRoleCode,
	tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<bigint | null> {
	if (roleIdCache.has(code)) return roleIdCache.get(code)!

	const rows = await tx.$queryRawUnsafe<Array<{ id: bigint }>>(
		`SELECT id FROM sys_roles WHERE code = ? AND deleted_at IS NULL LIMIT 1`,
		code,
	)
	const id = rows[0]?.id ?? null
	if (id != null) roleIdCache.set(code, id)
	return id
}

/**
 * 授予角色（幂等）
 *
 * @param scopeType  1=部门, 2=产品线, null=全局
 * @param scopeRefId 关联 departments/product_lines.id
 */
export async function grantRole(
	userId: number | bigint,
	roleCode: SystemRoleCode,
	opts: {
		scopeType?: 1 | 2 | null
		scopeRefId?: number | bigint | null
		createdBy?: number | bigint | null
		tx?: Prisma.TransactionClient | typeof prisma
	} = {},
): Promise<void> {
	const { scopeType = null, scopeRefId = null, createdBy = null, tx = prisma } = opts
	const roleId = await getRoleIdByCode(roleCode, tx)
	if (!roleId) throw new Error(`系统角色未配置：${roleCode}`)

	await tx.$executeRawUnsafe(
		`INSERT INTO sys_user_roles (user_id, role_id, scope_type, scope_ref_id, created_by)
		 VALUES (?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE id = id`,
		BigInt(userId), roleId,
		scopeType, scopeRefId != null ? BigInt(scopeRefId) : null,
		createdBy != null ? BigInt(createdBy) : null,
	)
}

/**
 * 撤销角色（按 code；可选 scope）
 *
 * - 不传 scopeType/scopeRefId 时撤销该用户的**所有** scope 下的该角色
 * - 传了则精准撤销某一条
 */
export async function revokeRole(
	userId: number | bigint,
	roleCode: SystemRoleCode,
	opts: {
		scopeType?: 1 | 2 | null
		scopeRefId?: number | bigint | null
		tx?: Prisma.TransactionClient | typeof prisma
	} = {},
): Promise<number> {
	const { scopeType, scopeRefId, tx = prisma } = opts
	const roleId = await getRoleIdByCode(roleCode, tx)
	if (!roleId) return 0

	if (scopeType === undefined && scopeRefId === undefined) {
		return await tx.$executeRawUnsafe(
			`DELETE FROM sys_user_roles WHERE user_id = ? AND role_id = ?`,
			BigInt(userId), roleId,
		)
	}

	// scope 精准撤销（NULL 需用 IS NULL 而非 = NULL）
	if (scopeType == null) {
		return await tx.$executeRawUnsafe(
			`DELETE FROM sys_user_roles WHERE user_id = ? AND role_id = ?
			   AND scope_type IS NULL AND scope_ref_id IS NULL`,
			BigInt(userId), roleId,
		)
	}

	return await tx.$executeRawUnsafe(
		`DELETE FROM sys_user_roles WHERE user_id = ? AND role_id = ?
		   AND scope_type = ? AND scope_ref_id = ?`,
		BigInt(userId), roleId,
		scopeType, scopeRefId != null ? BigInt(scopeRefId) : null,
	)
}

/**
 * 查某用户是否仍是**任何**产品线的 owner_user_id
 * 用于取消 pl_head 角色前的守卫
 */
export async function countProductLinesOwnedBy(
	userId: number | bigint,
	tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
	const rows = await tx.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
		`SELECT COUNT(*) AS cnt FROM doc_product_lines
		 WHERE deleted_at IS NULL AND owner_user_id = ?`,
		BigInt(userId),
	)
	return Number(rows[0]?.cnt ?? 0)
}

/**
 * 查某用户当前是否具备某角色（任意 scope）
 */
export async function hasRole(
	userId: number | bigint,
	roleCode: SystemRoleCode,
	tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<boolean> {
	const roleId = await getRoleIdByCode(roleCode, tx)
	if (!roleId) return false

	const rows = await tx.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
		`SELECT COUNT(*) AS cnt FROM sys_user_roles
		 WHERE user_id = ? AND role_id = ?`,
		BigInt(userId), roleId,
	)
	return Number(rows[0]?.cnt ?? 0) > 0
}
