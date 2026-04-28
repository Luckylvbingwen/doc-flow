import type { ApiResult } from '~/types/api'
import type { CreateCommentBody } from '~/server/schemas/comment'

export interface CommentUserVO {
	name: string
	avatar?: string
}

export interface CommentVO {
	id: number
	userId: number
	user: CommentUserVO
	content: string
	time: string
	deletable: boolean
	replies: CommentVO[]
}

/** 获取文档评论列表 */
export function apiGetComments(documentId: number) {
	return useAuthFetch<ApiResult<CommentVO[]>>(`/api/documents/${documentId}/comments`)
}

/** 新增评论 / 回复 */
export function apiCreateComment(documentId: number, body: CreateCommentBody) {
	return useAuthFetch<ApiResult<CommentVO>>(`/api/documents/${documentId}/comments`, {
		method: 'POST',
		body,
	})
}

/** 删除评论 */
export function apiDeleteComment(documentId: number, commentId: number) {
	return useAuthFetch<ApiResult<null>>(`/api/documents/${documentId}/comments/${commentId}`, {
		method: 'DELETE',
	})
}
