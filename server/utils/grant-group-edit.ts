/**
 * 发布后自动为组成员分配"可编辑"文档权限
 *
 * PRD 要求：草稿发布后组内成员自动获得"可编辑"权限（permission=2）
 * 跳过已有权限的成员和文档归属人（owner 天然有权限）
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'

/**
 * 为文档所属组的所有活跃成员批量插入 permission=2（可编辑）
 * - 跳过文档 owner（天然最高权限）
 * - 跳过已有 doc_document_permissions 记录的用户
 */
export async function grantGroupMembersEditPermission(
	documentId: bigint,
	groupId: number,
	grantedBy: number,
): Promise<void> {
	// 查询组内活跃成员（排除文档归属人）
	const doc = await prisma.doc_documents.findUnique({
		where: { id: documentId },
		select: { owner_user_id: true },
	})
	if (!doc) return

	const ownerId = doc.owner_user_id

	// 获取组成员（排除 owner + 已软删除的）
	const members = await prisma.doc_group_members.findMany({
		where: {
			group_id: BigInt(groupId),
			deleted_at: null,
			NOT: { user_id: ownerId },
		},
		select: { user_id: true },
	})
	if (members.length === 0) return

	const memberUserIds = members.map(m => m.user_id)

	// 查询已有权限记录的用户，避免重复
	const existing = await prisma.doc_document_permissions.findMany({
		where: {
			document_id: documentId,
			user_id: { in: memberUserIds },
			deleted_at: null,
		},
		select: { user_id: true },
	})
	const existingSet = new Set(existing.map(e => e.user_id.toString()))

	const toInsert = memberUserIds.filter(uid => !existingSet.has(uid.toString()))
	if (toInsert.length === 0) return

	// 批量插入
	const now = new Date()
	await prisma.doc_document_permissions.createMany({
		data: toInsert.map(userId => ({
			id: generateId(),
			document_id: documentId,
			user_id: userId,
			permission: 2,
			granted_by: BigInt(grantedBy),
			created_at: now,
			updated_at: now,
		})),
	})
}
