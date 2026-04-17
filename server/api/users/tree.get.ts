/**
 * GET /api/users/tree
 * 返回部门列表 + 部门下用户（供成员选择器使用）
 * 数据来源：本地已同步的 doc_departments + doc_feishu_users + doc_users
 *
 * Query:
 *   groupId (可选) — 传入时标记已是该组成员的用户
 */
import { prisma } from '~/server/utils/prisma'
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

	const deptFeishuIdMap = new Map<string, { id: number; name: string }>()
	for (const dept of departments) {
		if (dept.feishu_department_id) {
			deptFeishuIdMap.set(dept.feishu_department_id, {
				id: Number(dept.id),
				name: dept.name,
			})
		}
	}

	const deptMembersMap = new Map<number, Array<{
		id: number
		name: string
		email: string | null
		avatar: string | null
		joined: boolean
	}>>()

	for (const dept of departments) {
		deptMembersMap.set(Number(dept.id), [])
	}

	for (const u of users) {
		let deptIds: string[] = []
		const raw = u.feishu_department_ids
		if (Array.isArray(raw)) {
			deptIds = raw as string[]
		} else if (typeof raw === 'string' && raw) {
			try {
				deptIds = JSON.parse(raw)
			} catch {
				deptIds = []
			}
		}

		const userObj = {
			id: Number(u.user_id),
			name: u.name,
			email: u.email,
			avatar: u.avatar_url,
			joined: joinedUserIds.has(Number(u.user_id)),
		}

		for (const feishuDeptId of deptIds) {
			const dept = deptFeishuIdMap.get(feishuDeptId)
			if (dept) {
				deptMembersMap.get(dept.id)?.push(userObj)
			}
		}
	}

	const result = departments.map(dept => {
		const deptId = Number(dept.id)
		const members = deptMembersMap.get(deptId) || []
		return {
			id: deptId,
			name: dept.name,
			memberCount: members.length,
			members,
		}
	})

	return ok({ departments: result })
})
