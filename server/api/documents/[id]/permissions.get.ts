/**
 * GET /api/documents/:id/permissions
 * 文档级权限设置弹窗的初始数据（PRD §6.3.4）
 *
 * 鉴权：登录 + 组管理员（组内 role=1 / 组负责人 / 上游 scope 管理员），
 *      与"置顶"接口口径一致 — requireMemberPermission
 *
 * 返回结构：
 *   {
 *     groupMembers: [{ userId, name, avatar, role, isOwner }],   // 组权限只读区数据源
 *     customPerms:  [{ userId, name, avatar, permission, ... }], // 文档级权限区已自定义条目
 *   }
 *
 * 字段说明：
 *   - groupMembers.role：1管理员 / 2可编辑 / 3上传下载（与 PERMISSION_LEVEL 对齐）
 *   - groupMembers.isOwner：组负责人，UI 渲染 "组负责人" 角标（替代 role 标签）
 *   - customPerms.permission：2可编辑 / 3上传下载（弹窗内可改值的两档）
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	DOC_PERMISSION_NOT_IN_GROUP,
} from '~/server/constants/error-codes'

interface GroupMemberRow {
	user_id: bigint
	name: string
	avatar_url: string | null
	role: number
	is_owner: number
}

interface CustomPermRow {
	id: bigint
	user_id: bigint
	name: string
	avatar_url: string | null
	permission: number
	granted_by: bigint
	granter_name: string | null
	created_at: Date
}

export default defineEventHandler(async (event) => {
	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)

	// 拉文档元数据 + 校验存在性 + 拿 group_id（用于权限校验）
	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, group_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (!doc.group_id) {
		return fail(event, 409, DOC_PERMISSION_NOT_IN_GROUP, '该文档未归属任何组，无法设置文档级权限')
	}

	const group = await prisma.doc_groups.findUnique({
		where: { id: doc.group_id },
		select: { id: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
	})
	if (!group) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档所属组不存在')

	const permErr = await requireMemberPermission(event, {
		groupId: Number(group.id),
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id != null ? Number(group.scope_ref_id) : null,
		ownerUserId: group.owner_user_id != null ? Number(group.owner_user_id) : null,
	})
	if (permErr) return permErr

	// 组成员只读区数据
	const memberRows = await prisma.$queryRaw<GroupMemberRow[]>`
		SELECT
			gm.user_id,
			u.name,
			u.avatar_url,
			gm.role,
			(CASE WHEN g.owner_user_id = gm.user_id THEN 1 ELSE 0 END) AS is_owner
		FROM doc_group_members gm
		JOIN doc_users  u ON u.id = gm.user_id
		JOIN doc_groups g ON g.id = gm.group_id
		WHERE gm.group_id = ${group.id} AND gm.deleted_at IS NULL
		ORDER BY is_owner DESC, gm.role ASC, gm.joined_at ASC
	`

	// 文档级权限区已自定义条目
	const customRows = await prisma.$queryRaw<CustomPermRow[]>`
		SELECT
			p.id,
			p.user_id,
			u.name,
			u.avatar_url,
			p.permission,
			p.granted_by,
			gu.name AS granter_name,
			p.created_at
		FROM doc_document_permissions p
		JOIN doc_users u ON u.id = p.user_id
		LEFT JOIN doc_users gu ON gu.id = p.granted_by
		WHERE p.document_id = ${docId} AND p.deleted_at IS NULL
		ORDER BY p.created_at ASC
	`

	const groupMembers = memberRows.map((r) => ({
		userId: Number(r.user_id),
		name: r.name,
		avatar: r.avatar_url,
		role: r.role,
		isOwner: Number(r.is_owner) === 1,
	}))

	const customPerms = customRows.map((r) => ({
		id: Number(r.id),
		userId: Number(r.user_id),
		name: r.name,
		avatar: r.avatar_url,
		permission: r.permission,
		grantedBy: Number(r.granted_by),
		grantedByName: r.granter_name ?? '',
		grantedAt: r.created_at.getTime(),
	}))

	return ok({ groupMembers, customPerms })
})
