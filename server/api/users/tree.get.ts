/**
 * GET /api/users/tree
 * 返回部门列表 + 部门下用户（供成员选择器使用）
 * 数据来源：本地已同步的 doc_departments + doc_feishu_users + doc_users
 *
 * Query:
 *   groupId (可选) — 传入时标记已是该组成员的用户
 */
import { prisma } from '~/server/utils/prisma'
import { buildDeptTree } from '~/server/utils/user-tree'
import type { UserTreeDeptRow, UserTreeUserRow, JoinedUserRow } from '~/server/types/group-member'

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const groupId = query.groupId ? Number(query.groupId) : null

	const departments = await prisma.$queryRaw<UserTreeDeptRow[]>`
		SELECT id, name, feishu_department_id
		FROM doc_departments
		WHERE deleted_at IS NULL AND status = 1
		ORDER BY name ASC
	`

	const users = await prisma.$queryRaw<UserTreeUserRow[]>`
		SELECT
			u.id AS user_id, u.name, u.email, u.avatar_url,
			fu.feishu_department_ids
		FROM doc_users u
		JOIN doc_feishu_users fu ON fu.feishu_open_id = u.feishu_open_id AND fu.status = 'normal'
		WHERE u.deleted_at IS NULL AND u.status = 1
		ORDER BY u.name ASC
	`

	const joinedUserIds = new Set<number>()
	if (groupId) {
		const joined = await prisma.$queryRaw<JoinedUserRow[]>`
			SELECT user_id FROM doc_group_members
			WHERE group_id = ${groupId} AND deleted_at IS NULL
		`
		for (const row of joined) {
			joinedUserIds.add(Number(row.user_id))
		}
	}

	return ok({ departments: buildDeptTree(departments, users, joinedUserIds) })
})
