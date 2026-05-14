/**
 * 权限继承工具 — 创建组时自动注入上级负责人为继承成员
 *
 * source_type=3（继承），immutable_flag=1（不可移除/降权）
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'

/**
 * 为新创建的组注入继承成员（部门负责人 / 产品线负责人）
 * 调用时机：组创建事务完成后
 */
export async function injectInheritedMembers(
	groupId: bigint,
	scopeType: number,
	scopeRefId: bigint | null,
	createdBy: bigint,
) {
	if (!scopeRefId) return

	const ownerUserIds: bigint[] = []

	if (scopeType === 2) {
		// 部门：取部门负责人
		const dept = await prisma.doc_departments.findFirst({
			where: { id: scopeRefId, deleted_at: null },
			select: { owner_user_id: true },
		})
		if (dept?.owner_user_id) ownerUserIds.push(dept.owner_user_id)
	} else if (scopeType === 3) {
		// 产品线：取产品线负责人
		const pl = await prisma.doc_product_lines.findFirst({
			where: { id: scopeRefId, deleted_at: null },
			select: { owner_user_id: true },
		})
		if (pl?.owner_user_id) ownerUserIds.push(pl.owner_user_id)
	}

	for (const ownerUserId of ownerUserIds) {
		// 检查是否已是成员
		const existing = await prisma.doc_group_members.findFirst({
			where: {
				group_id: groupId,
				user_id: ownerUserId,
				deleted_at: null,
			},
		})
		if (existing) continue

		await prisma.doc_group_members.create({
			data: {
				id: generateId(),
				group_id: groupId,
				user_id: ownerUserId,
				role: 1,             // 管理员
				source_type: 3,      // 继承
				immutable_flag: 1,   // 不可移除
				created_by: createdBy,
			},
		})
	}
}

/**
 * 当部门/产品线负责人变更时，批量更新所有子孙组的继承成员
 * 调用时机：飞书同步负责人变更 / 手动指派负责人
 */
export async function syncInheritedMembers(
	scopeType: number,
	scopeRefId: bigint,
	oldOwnerUserId: bigint | null,
	newOwnerUserId: bigint,
	operatorUserId: bigint,
) {
	// 查找所有属于该 scope 的组
	const groups = await prisma.doc_groups.findMany({
		where: {
			scope_type: scopeType,
			scope_ref_id: scopeRefId,
			deleted_at: null,
		},
		select: { id: true },
	})

	for (const group of groups) {
		// 移除旧负责人的继承成员记录
		if (oldOwnerUserId) {
			await prisma.doc_group_members.updateMany({
				where: {
					group_id: group.id,
					user_id: oldOwnerUserId,
					source_type: 3,
					deleted_at: null,
				},
				data: { deleted_at: new Date() },
			})
		}

		// 添加新负责人为继承成员（如果不已经是成员）
		const existing = await prisma.doc_group_members.findFirst({
			where: {
				group_id: group.id,
				user_id: newOwnerUserId,
				deleted_at: null,
			},
		})
		if (!existing) {
			await prisma.doc_group_members.create({
				data: {
					id: generateId(),
					group_id: group.id,
					user_id: newOwnerUserId,
					role: 1,
					source_type: 3,
					immutable_flag: 1,
					created_by: operatorUserId,
				},
			})
		}
	}
}
