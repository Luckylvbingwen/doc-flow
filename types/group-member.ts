/**
 * 组成员管理 — 前端类型
 */

export type { AddMembersBody, UpdateMemberRoleBody } from '~/server/schemas/group-member'

/** 成员列表项 */
export interface GroupMember {
	id: number
	userId: number
	name: string
	email: string | null
	avatar: string | null
	role: 1 | 2 | 3
	sourceType: 1 | 2 | 3
	immutableFlag: 0 | 1
	joinedAt: number
}

/** 成员选择器 — 部门节点 */
export interface DeptTreeNode {
	id: number
	name: string
	memberCount: number
	members: DeptTreeMember[]
}

/** 成员选择器 — 部门下用户 */
export interface DeptTreeMember {
	id: number
	name: string
	email: string | null
	avatar: string | null
	joined: boolean
}

/** 成员选择器 — 选中结果 */
export interface SelectedUser {
	id: number
	name: string
	avatar: string | null
}

/** 成员角色标签映射 */
export const MEMBER_ROLE_MAP: Record<number, string> = {
	1: '管理员',
	2: '可编辑',
	3: '上传下载',
}

/** 成员来源标签映射 */
export const MEMBER_SOURCE_MAP: Record<number, string> = {
	1: '手动添加',
	2: '飞书同步',
	3: '继承',
}
