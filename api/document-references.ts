import type { ApiResult } from '~/types/api'

export interface ReferenceSearchItem {
  id: number
  title: string
  ext: string
  groupId: number
  groupName: string
  versionNo: string
  ownerName: string
  updatedAt: number
  isReferenced: boolean
}

/** 搜索可引用文档（添加引用弹窗） */
export function apiSearchReferences(groupId: number, params?: {
  keyword?: string
  sourceGroupId?: number
  page?: number
  pageSize?: number
}) {
  return useAuthFetch<ApiResult<{
    list: ReferenceSearchItem[]
    total: number
    page: number
    pageSize: number
  }>>(`/api/groups/${groupId}/references/search`, {
    method: 'GET',
    query: params,
  })
}

/** 批量添加引用 */
export function apiAddReferences(groupId: number, documentIds: number[]) {
  return useAuthFetch<ApiResult<{ created: number; skipped: number }>>(`/api/groups/${groupId}/references`, {
    method: 'POST',
    body: { documentIds },
  })
}

/** 取消引用 */
export function apiDeleteReference(groupId: number, refId: number) {
  return useAuthFetch<ApiResult<null>>(`/api/groups/${groupId}/references/${refId}`, {
    method: 'DELETE',
  })
}
