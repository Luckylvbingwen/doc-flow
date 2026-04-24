import type { ApiResult } from '~/types/api'
import type {
	DocumentDetail,
	DocumentListResponse,
	PreviewResponse,
	UploadResult,
} from '~/types/document'
import type { DocumentListQuery } from '~/server/schemas/document'

/** 仓库文件列表（默认 status=4 已发布） */
export function apiGetDocuments(params: DocumentListQuery) {
	return useAuthFetch<ApiResult<DocumentListResponse>>('/api/documents', {
		method: 'GET',
		query:  params,
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
		body:   formData,
	})
}

/** 更新版本（multipart） */
export function apiUploadNewVersion(id: number, formData: FormData) {
	return useAuthFetch<ApiResult<UploadResult>>(`/api/documents/${id}/versions`, {
		method: 'POST',
		body:   formData,
	})
}

/** 移除文档（已发布 → 草稿，退回归属人个人中心） */
export function apiRemoveDocument(id: number) {
	return useAuthFetch<ApiResult<{ id: number }>>(`/api/documents/${id}/remove`, {
		method: 'PUT',
	})
}

/** 预览（服务端渲染 MD） */
export function apiPreviewDocument(id: number, versionId?: number) {
	return useAuthFetch<ApiResult<PreviewResponse>>(`/api/documents/${id}/preview`, {
		method: 'GET',
		query:  versionId ? { versionId } : {},
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
