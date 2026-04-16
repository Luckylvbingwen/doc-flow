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
