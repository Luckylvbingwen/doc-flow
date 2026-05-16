/**
 * DELETE /api/departments/:id
 * 删除飞书侧已撤销的部门
 *
 * 权限：部门负责人 + 系统管理员
 * 前置条件：部门下所有组内无文档
 */
import { prisma } from '~/server/utils/prisma'
import {
	INVALID_PARAMS,
	DEPARTMENT_NOT_FOUND,
	DEPARTMENT_HAS_DOCUMENTS,
	PERMISSION_DENIED,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const user = event.context.user!
	const idParam = getRouterParam(event, 'id')
	const deptId = Number(idParam)
	if (!Number.isFinite(deptId) || deptId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '部门 ID 无效')
	}

	const dept = await prisma.doc_departments.findFirst({
		where: { id: BigInt(deptId), deleted_at: null },
		select: { id: true, name: true, owner_user_id: true, feishu_revoked: true },
	})
	if (!dept) return fail(event, 404, DEPARTMENT_NOT_FOUND, '部门不存在')

	// 权限校验：部门负责人 或 系统管理员
	const isSuperAdmin = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
		`SELECT COUNT(*) AS cnt FROM sys_user_roles ur
		 JOIN sys_roles r ON r.id = ur.role_id
		 WHERE ur.user_id = ? AND r.code = 'super_admin'`,
		BigInt(user.id),
	)
	const isDeptOwner = dept.owner_user_id && BigInt(dept.owner_user_id) === BigInt(user.id)
	const isAdmin = (isSuperAdmin[0]?.cnt ?? 0) > 0

	if (!isDeptOwner && !isAdmin) {
		return fail(event, 403, PERMISSION_DENIED, '仅部门负责人或系统管理员可删除部门')
	}

	// 前置条件：部门下所有组内无文档
	const docCount = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
		`SELECT COUNT(*) AS cnt FROM doc_documents d
		 JOIN doc_groups g ON g.id = d.group_id
		 WHERE g.scope_type = 2 AND g.scope_ref_id = ? AND g.deleted_at IS NULL AND d.deleted_at IS NULL`,
		BigInt(deptId),
	)
	if ((docCount[0]?.cnt ?? 0) > 0) {
		return fail(event, 400, DEPARTMENT_HAS_DOCUMENTS, '部门下的组中仍有文档，请先处理文档后再删除部门')
	}

	// 软删除部门
	await prisma.doc_departments.update({
		where: { id: BigInt(deptId) },
		data: { deleted_at: new Date() },
	})

	// 软删除部门下的所有组
	await prisma.$executeRawUnsafe(
		`UPDATE doc_groups SET deleted_at = NOW(3)
		 WHERE scope_type = 2 AND scope_ref_id = ? AND deleted_at IS NULL`,
		BigInt(deptId),
	)

	return ok(null, '部门已删除')
})
