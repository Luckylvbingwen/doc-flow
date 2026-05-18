import type { DraftContent, EditCopyResult, AnnotationItem, AnnotationReply } from '~/types/document-editor'
import type { ApiResult } from '~/types/api'

// ── 草稿 ──
export const apiCreateDraft = (body?: { title?: string; groupId?: number }) =>
	useAuthFetch<ApiResult<{ id: string }>>('/api/documents', { method: 'POST', body: body ?? {} })

export const apiGetDocContent = (id: number) =>
	useAuthFetch<ApiResult<DraftContent>>(`/api/documents/${id}/content`)

export const apiSaveDocContent = (id: number, body: { content: string; title?: string }) =>
	useAuthFetch<ApiResult<null>>(`/api/documents/${id}/content`, { method: 'PUT', body })

// ── 编辑副本 ──
export const apiCreateEditCopy = (id: number) =>
	useAuthFetch<ApiResult<EditCopyResult>>(`/api/documents/${id}/edit-copy`, { method: 'POST', body: {} })

// ── 批注 ──
export const apiGetAnnotations = (docId: number) =>
	useAuthFetch<ApiResult<AnnotationItem[]>>(`/api/documents/${docId}/annotations`)

export const apiCreateAnnotation = (docId: number, body: { content: string; quoteText: string; anchorData?: Record<string, unknown>; mentionedUserIds?: number[] }) =>
	useAuthFetch<ApiResult<AnnotationItem>>(`/api/documents/${docId}/annotations`, { method: 'POST', body })

export const apiUpdateAnnotation = (docId: number, annotationId: string, body: { content?: string; status?: number }) =>
	useAuthFetch<ApiResult<null>>(`/api/documents/${docId}/annotations/${annotationId}`, { method: 'PUT', body })

export const apiDeleteAnnotation = (docId: number, annotationId: string) =>
	useAuthFetch<ApiResult<null>>(`/api/documents/${docId}/annotations/${annotationId}`, { method: 'DELETE' })

export const apiCreateAnnotationReply = (docId: number, annotationId: string, body: { content: string; mentionedUserIds?: number[] }) =>
	useAuthFetch<ApiResult<AnnotationReply>>(`/api/documents/${docId}/annotations/${annotationId}/replies`, { method: 'POST', body })

// ── @提及用户搜索 ──
export interface MentionUser { id: number; name: string; avatar: string | null }

export const apiSearchMentionUsers = (keyword: string) =>
	useAuthFetch<ApiResult<MentionUser[]>>(`/api/users/search?keyword=${encodeURIComponent(keyword)}`)
