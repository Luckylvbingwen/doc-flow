/**
 * GET /api/departments/:id
 * 部门详情
 */
import { prisma } from '~/server/utils/prisma'
import {
	INVALID_PARAMS,
	DEPARTMENT_NOT_FOUND,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const idParam = getRouterParam(event, 'id')
	const deptId = Number(idParam)
	if (!Number.isFinite(deptId) || deptId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '部门 ID 无效')
	}

	const dept = await prisma.doc_departments.findFirst({
		where: { id: BigInt(deptId), deleted_at: null },
		select: {
			id: true,
			name: true,
			description: true,
			owner_user_id: true,
			feishu_department_id: true,
			status: true,
			created_at: true,
			updated_at: true,
		},
	})
	if (!dept) return fail(event, 404, DEPARTMENT_NOT_FOUND, '部门不存在')

	// 获取负责人名称
	let ownerName: string | null = null
	if (dept.owner_user_id) {
		const owner = await prisma.doc_users.findFirst({
			where: { id: dept.owner_user_id, deleted_at: null },
			select: { name: true },
		})
		ownerName = owner?.name ?? null
	}

	// 统计下属组数量
	const groupCount = await prisma.doc_groups.count({
		where: { department_id: BigInt(deptId), deleted_at: null },
	})

	return ok({
		id: Number(dept.id),
		name: dept.name,
		description: dept.description,
		ownerUserId: dept.owner_user_id ? Number(dept.owner_user_id) : null,
		ownerName,
		feishuDepartmentId: dept.feishu_department_id,
		isSynced: !!dept.feishu_department_id,
		status: dept.status,
		groupCount,
		createdAt: dept.created_at.getTime(),
		updatedAt: dept.updated_at.getTime(),
	})
})
