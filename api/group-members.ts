import type { ApiResult } from '~/types/api'
import type { GroupMember, AddMembersBody, UpdateMemberRoleBody, DeptTreeNode } from '~/types/group-member'

/** 获取组成员列表 */
export function apiGetGroupMembers(groupId: number) {
	return useAuthFetch<ApiResult<GroupMember[]>>(`/api/groups/${groupId}/members`)
}

/** 批量添加成员 */
export function apiAddGroupMembers(groupId: number, body: AddMembersBody) {
	return useAuthFetch<ApiResult<{ added: number; skipped: number }>>(`/api/groups/${groupId}/members`, {
		method: 'POST',
		body,
	})
}

/** 修改成员权限 */
export function apiUpdateMemberRole(groupId: number, memberId: number, body: UpdateMemberRoleBody) {
	return useAuthFetch<ApiResult>(`/api/groups/${groupId}/members/${memberId}`, {
		method: 'PUT',
		body,
	})
}

/** 移除成员 */
export function apiRemoveMember(groupId: number, memberId: number) {
	return useAuthFetch<ApiResult>(`/api/groups/${groupId}/members/${memberId}`, {
		method: 'DELETE',
	})
}

/** 获取部门用户树（成员选择器数据源） */
export function apiGetUserTree(groupId?: number) {
	const query = groupId ? `?groupId=${groupId}` : ''
	return useAuthFetch<ApiResult<{ departments: DeptTreeNode[] }>>(`/api/users/tree${query}`)
}
