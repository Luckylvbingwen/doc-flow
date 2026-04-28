import type { ApiResult } from '~/types/api'
import type {
	DocumentDetail,
	DocumentListResponse,
	PreviewResponse,
	UploadResult,
} from '~/types/document'
import type { DocumentListQuery } from '~/server/schemas/document'
import type { ApprovalItem } from '~/types/approval'

/** 组文件列表（默认 status=4 已发布） */
export function apiGetDocuments(params: DocumentListQuery) {
	return useAuthFetch<ApiResult<DocumentListResponse>>('/api/documents', {
		method: 'GET',
		query: params,
	})
}

/** 文件详情 */
export function apiGetDocument(id: number) {
	return useAuthFetch<ApiResult<DocumentDetail>>(`/api/documents/${id}`)
}

/** 首次上传（multipart） */
export function apiUploadDocument(formData: FormData) {
	return useAuthFetch<ApiResult<UploadResult>>('/api/documents/upload', {
		method: 'POST',
		body: formData,
	})
}

/** 更新版本（multipart） */
export function apiUploadNewVersion(id: number, formData: FormData) {
	return useAuthFetch<ApiResult<UploadResult>>(`/api/documents/${id}/versions`, {
		method: 'POST',
		body: formData,
	})
}

/** 移除文档（已发布 → 草稿，退回归属人个人中心） */
export function apiRemoveDocument(id: number) {
	return useAuthFetch<ApiResult<{ id: number }>>(`/api/documents/${id}/remove`, {
		method: 'PUT',
	})
}

/** 批量移除文档 */
export function apiBatchRemoveDocuments(ids: number[]) {
	return useAuthFetch<ApiResult<{ removedCount: number; removedIds: number[]; failed: Array<{ id: number; reason: string }> }>>('/api/documents/batch-remove', {
		method: 'POST',
		body: { ids },
	})
}

/** 版本回滚（PRD §6.3.4 — 回滚生成新版本，不删除中间版本） */
export function apiRollbackVersion(id: number, versionId: number) {
	return useAuthFetch<ApiResult<{
		documentId: number
		versionId: number
		versionNo: string
		rollbackFrom: string
	}>>(`/api/documents/${id}/rollback`, {
		method: 'POST',
		body: { versionId },
	})
}

/** 预览（服务端渲染 MD） */
export function apiPreviewDocument(id: number, versionId?: number) {
	return useAuthFetch<ApiResult<PreviewResponse>>(`/api/documents/${id}/preview`, {
		method: 'GET',
		query: versionId ? { versionId } : {},
	})
}

/**
 * 生成下载 URL（给 <a href> 或 window.location.href 直接跳转用）
 *
 * 后端返回 302 redirect 到 MinIO presigned URL，浏览器自动走下载
 */
export function apiDownloadDocumentUrl(id: number, versionId?: number): string {
	const q = versionId ? `?versionId=${versionId}` : ''
	return `/api/documents/${id}/download${q}`
}

/** 收藏文档（幂等；返回最终 isFavorited 值供前端对账） */
export function apiFavoriteDocument(id: number) {
	return useAuthFetch<ApiResult<{ isFavorited: boolean }>>(`/api/documents/${id}/favorite`, {
		method: 'POST',
	})
}

/** 取消收藏（幂等） */
export function apiUnfavoriteDocument(id: number) {
	return useAuthFetch<ApiResult<{ isFavorited: boolean }>>(`/api/documents/${id}/favorite`, {
		method: 'DELETE',
	})
}

/** 置顶文档（幂等；组管理员及上游可用） */
export function apiPinDocument(id: number) {
	return useAuthFetch<ApiResult<{ isPinned: boolean }>>(`/api/documents/${id}/pin`, {
		method: 'POST',
	})
}

/** 取消置顶（幂等） */
export function apiUnpinDocument(id: number) {
	return useAuthFetch<ApiResult<{ isPinned: boolean }>>(`/api/documents/${id}/pin`, {
		method: 'DELETE',
	})
}

/**
 * 单文档审批历史（PRD §6.3.4 底部 TAB「审批记录」）
 * 不分页，按 inst.created_at DESC 全量返回；canWithdraw 恒 false
 */
export function apiGetDocumentApprovals(id: number) {
	return useAuthFetch<ApiResult<ApprovalItem[]>>(`/api/documents/${id}/approvals`)
}

/** 发起跨组移动 */
export function apiRequestCrossMove(documentId: number, targetGroupId: number) {
	return useAuthFetch<ApiResult<{ moveId: number }>>(`/api/documents/${documentId}/move`, {
		method: 'POST',
		body: { targetGroupId },
	})
}

/** 审核跨组移动 */
export function apiReviewCrossMove(moveId: number, action: 'approve' | 'reject') {
	return useAuthFetch<ApiResult<null>>(`/api/documents/cross-move/${moveId}/review`, {
		method: 'PUT',
		body: { action },
	})
}
