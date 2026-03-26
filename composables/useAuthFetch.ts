/**
 * 带鉴权的 $fetch 封装
 * - 自动注入 Authorization: Bearer <token>
 * - 401 响应自动清除会话并跳转登录页
 */
import { ElMessage } from 'element-plus'

type FetchOptions = Parameters<typeof $fetch>[1]

export function useAuthFetch<T = unknown>(url: string, options: FetchOptions = {}) {
	const authStore = useAuthStore()

	return $fetch<T>(url, {
		...options,
		headers: {
			...options.headers,
			...(authStore.token ? { Authorization: `${authStore.tokenType} ${authStore.token}` } : {})
		},
		async onResponseError({ response }) {
			if (response.status === 401) {
				authStore.clearSession()
				ElMessage.error('登录已过期，请重新登录')
				await navigateTo('/login')
			}
		}
	})
}
