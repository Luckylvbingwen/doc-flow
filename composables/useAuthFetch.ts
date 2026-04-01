/**
 * 带鉴权的 $fetch 封装
 * - 自动注入 Authorization: Bearer <token>
 * - accessToken 过期时自动用 refreshToken 续期
 * - refreshToken 也过期则清除会话并跳转登录页
 */
import { ElMessage } from 'element-plus'

type FetchOptions = Parameters<typeof $fetch>[1]

/** 防止多个请求同时触发 refresh */
let refreshPromise: Promise<boolean> | null = null

async function doRefresh(authStore: ReturnType<typeof useAuthStore>): Promise<boolean> {
	if (!authStore.refreshToken) return false

	try {
		const res = await $fetch<{
			success: boolean
			data?: { token: string; tokenType: 'Bearer'; expiresIn: number }
		}>('/api/auth/refresh', {
			method: 'POST',
			body: { refreshToken: authStore.refreshToken },
		})

		if (res.success && res.data) {
			authStore.token = res.data.token
			authStore.expiresAt = Date.now() + res.data.expiresIn * 1000
			authStore._persistToStorage()
			return true
		}
	} catch {
		// refresh 失败
	}
	return false
}

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
				// 尝试用 refreshToken 续期
				if (authStore.refreshToken && authStore.refreshExpiresAt > Date.now()) {
					if (!refreshPromise) {
						refreshPromise = doRefresh(authStore).finally(() => { refreshPromise = null })
					}
					const refreshed = await refreshPromise
					if (refreshed) {
						// 续期成功，但当前请求已经失败了
						// 调用方需自行重试，这里不自动重试以避免副作用
						return
					}
				}

				authStore.clearSession()
				ElMessage.error('登录已过期，请重新登录')
				await navigateTo('/login')
			}
		}
	})
}
