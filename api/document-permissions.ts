import type { ApiResult } from '~/types/api'
import type {
	DocPermissionsResponse,
	DocPermissionPutBody,
	DocPermissionPutResult,
} from '~/types/document-permission'

/** 获取文档级权限弹窗初始数据（组成员只读区 + 已自定义条目） */
export function apiGetDocPermissions(id: number) {
	return useAuthFetch<ApiResult<DocPermissionsResponse>>(`/api/documents/${id}/permissions`)
}

/** 整包保存文档级权限（草稿模式 PUT，事务内 diff + 操作日志） */
export function apiPutDocPermissions(id: number, body: DocPermissionPutBody) {
	return useAuthFetch<ApiResult<DocPermissionPutResult>>(`/api/documents/${id}/permissions`, {
		method: 'PUT',
		body,
	})
}
