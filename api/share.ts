import type { ApiResult } from '~/types/api'

export interface ShareLinkResult {
	token: string
	url: string
}

export interface ShareViewResult {
	documentId: number
	title: string
	permission: number
}

/** 创建分享链接 */
export function apiCreateShareLink(documentId: number, permission: 2 | 4) {
	return useAuthFetch<ApiResult<ShareLinkResult>>('/api/share/create', {
		method: 'POST',
		body: { documentId, permission },
	})
}

/** 打开分享链接（获取文档信息） */
export function apiOpenShareLink(token: string) {
	return useAuthFetch<ApiResult<ShareViewResult>>(`/api/share/${token}`)
}
