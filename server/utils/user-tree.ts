/**
 * 部门用户树组装 — 纯函数
 * 提取自 `server/api/users/tree.get.ts`，便于单元测试。
 */
import type { UserTreeDeptRow, UserTreeUserRow } from '~/server/types/group-member'

export interface DeptTreeMember {
	id: number
	name: string
	email: string | null
	avatar: string | null
	joined: boolean
}

export interface DeptTreeNode {
	id: number
	name: string
	memberCount: number
	members: DeptTreeMember[]
}

/**
 * 解析 `feishu_department_ids` 字段。
 * Prisma JSON 列在不同驱动下可能返回数组或字符串，容错处理两种形式。
 */
export function parseFeishuDeptIds(raw: string | string[] | null | undefined): string[] {
	if (Array.isArray(raw)) return raw as string[]
	if (typeof raw === 'string' && raw) {
		try {
			return JSON.parse(raw)
		} catch {
			return []
		}
	}
	return []
}

/**
 * 把部门列表 + 用户列表 + 已加入用户 ID 组装成选择器树。
 * 一个用户可能挂在多个部门下，会重复出现。
 */
export function buildDeptTree(
	departments: UserTreeDeptRow[],
	users: UserTreeUserRow[],
	joinedUserIds: Set<number>,
): DeptTreeNode[] {
	const deptByFeishuId = new Map<string, { id: number; name: string }>()
	for (const dept of departments) {
		if (dept.feishu_department_id) {
			deptByFeishuId.set(dept.feishu_department_id, {
				id: Number(dept.id),
				name: dept.name,
			})
		}
	}

	const deptMembers = new Map<number, DeptTreeMember[]>()
	for (const dept of departments) {
		deptMembers.set(Number(dept.id), [])
	}

	for (const u of users) {
		const deptIds = parseFeishuDeptIds(u.feishu_department_ids)
		const userObj: DeptTreeMember = {
			id: Number(u.user_id),
			name: u.name,
			email: u.email,
			avatar: u.avatar_url,
			joined: joinedUserIds.has(Number(u.user_id)),
		}

		for (const feishuDeptId of deptIds) {
			const dept = deptByFeishuId.get(feishuDeptId)
			if (dept) {
				deptMembers.get(dept.id)?.push(userObj)
			}
		}
	}

	return departments.map((dept) => {
		const deptId = Number(dept.id)
		const members = deptMembers.get(deptId) || []
		return {
			id: deptId,
			name: dept.name,
			memberCount: members.length,
			members,
		}
	})
}
