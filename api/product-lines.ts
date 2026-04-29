import type { ApiResult } from '~/types/api'
import type { ProductLineItem } from '~/types/group'
import type { ProductLineCreateBody, ProductLineUpdateBody } from '~/server/schemas/product-line'

/** 产品线列表 */
export function apiGetProductLines() {
	return useAuthFetch<ApiResult<ProductLineItem[]>>('/api/product-lines')
}

/** 创建产品线 */
export function apiCreateProductLine(params: ProductLineCreateBody) {
	return useAuthFetch<ApiResult<{ id: number }>>('/api/product-lines', {
		method: 'POST',
		body: params,
	})
}

/** 编辑产品线 */
export function apiUpdateProductLine(id: number, params: ProductLineUpdateBody) {
	return useAuthFetch<ApiResult>(`/api/product-lines/${id}`, {
		method: 'PUT',
		body: params,
	})
}

/** 删除产品线 */
export function apiDeleteProductLine(id: number) {
	return useAuthFetch<ApiResult>(`/api/product-lines/${id}`, {
		method: 'DELETE',
	})
}

// ── 产品线管理员 ──

export interface PLAdminItem {
	userId: number
	name: string
	email: string | null
	avatarUrl: string | null
	isOwner: boolean
	createdAt: number
}

/** 产品线管理员列表 */
export function apiGetPLAdmins(plId: number) {
	return useAuthFetch<ApiResult<PLAdminItem[]>>(`/api/product-lines/${plId}/admins`)
}

/** 添加产品线管理员 */
export function apiAddPLAdmin(plId: number, userId: number) {
	return useAuthFetch<ApiResult>(`/api/product-lines/${plId}/admins`, {
		method: 'POST',
		body: { userId },
	})
}

/** 移除产品线管理员 */
export function apiRemovePLAdmin(plId: number, userId: number) {
	return useAuthFetch<ApiResult>(`/api/product-lines/${plId}/admins/${userId}`, {
		method: 'DELETE',
	})
}

// ── 产品线下属组 ──

export interface PLGroupItem {
	id: number
	name: string
	description: string | null
	ownerUserId: number | null
	ownerName: string | null
	fileCount: number
	memberCount: number
	childCount: number
	updatedAt: number
}

/** 产品线下属项目组列表 */
export function apiGetPLGroups(plId: number) {
	return useAuthFetch<ApiResult<PLGroupItem[]>>(`/api/product-lines/${plId}/groups`)
}
