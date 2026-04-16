/**
 * DELETE /api/groups/:id
 * 删除组(软删除) -- 含文件或子组时拒绝
 */
import { prisma } from '~/server/utils/prisma'
import { requireGroupPermission } from '~/server/utils/group-permission'
import {
	GROUP_NOT_FOUND,
	GROUP_HAS_DOCUMENTS,
	GROUP_HAS_CHILDREN,
	INVALID_PARAMS,
} from '~/server/constants/error-codes'
import type { GroupCheckRow, CountRow } from '~/server/types/group'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	// 校验组存在
	const rows = await prisma.$queryRaw<GroupCheckRow[]>`
		SELECT id, scope_type, scope_ref_id, owner_user_id
		FROM doc_groups WHERE id = ${id} AND deleted_at IS NULL
	`
	if (!rows.length) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	// 权限校验
	const group = rows[0]
	const denied = await requireGroupPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
	})
	if (denied) return denied

	// 检查是否含文档
	const docCount = await prisma.$queryRaw<CountRow[]>`
		SELECT COUNT(*) AS cnt FROM doc_documents
		WHERE group_id = ${id} AND deleted_at IS NULL
	`
	if (Number(docCount[0]?.cnt) > 0) {
		return fail(event, 400, GROUP_HAS_DOCUMENTS, '组内含文档，请先移除或删除文档')
	}

	// 检查是否含子组
	const childCount = await prisma.$queryRaw<CountRow[]>`
		SELECT COUNT(*) AS cnt FROM doc_groups
		WHERE parent_id = ${id} AND deleted_at IS NULL
	`
	if (Number(childCount[0]?.cnt) > 0) {
		return fail(event, 400, GROUP_HAS_CHILDREN, '组内含子组，请先删除子组')
	}

	// 软删除
	await prisma.$executeRaw`
		UPDATE doc_groups SET deleted_at = NOW(3) WHERE id = ${id}
	`

	return ok(null, '组已删除')
})
