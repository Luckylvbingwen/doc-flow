/**
 * DELETE /api/groups/:id
 * 删除组（软删除） — 含文件或子组时拒绝
 */
import { prisma } from '~/server/utils/prisma'
import { requireGroupPermission } from '~/server/utils/group-permission'
import {
	GROUP_NOT_FOUND,
	GROUP_HAS_DOCUMENTS,
	GROUP_HAS_CHILDREN,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	// 校验组存在
	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: { id: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	// 权限校验
	const denied = await requireGroupPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
	})
	if (denied) return denied

	// 检查是否含文档
	const docCount = await prisma.doc_documents.count({
		where: { group_id: BigInt(id), deleted_at: null },
	})
	if (docCount > 0) {
		return fail(event, 400, GROUP_HAS_DOCUMENTS, '组内含文档，请先移除或删除文档')
	}

	// 检查是否含子组
	const childCount = await prisma.doc_groups.count({
		where: { parent_id: BigInt(id), deleted_at: null },
	})
	if (childCount > 0) {
		return fail(event, 400, GROUP_HAS_CHILDREN, '组内含子组，请先删除子组')
	}

	// 软删除
	await prisma.doc_groups.update({
		where: { id: BigInt(id) },
		data: { deleted_at: new Date() },
	})

	return ok(null, '组已删除')
})
