/**
 * 带鉴权的 $fetch 封装
 * - 自动注入 Authorization: Bearer <token>
 * - accessToken 过期时自动用 refreshToken 续期
 * - refreshToken 也过期则清除会话并跳转登录页
 * - 非 401 错误自动重试（指数退避，最多 2 次）
 * - 离线检测与 toast 提示
 */
import { ElMessage } from 'element-plus'

type FetchOptions = Parameters<typeof $fetch>[1]

type AuthFetchOptions = FetchOptions & {
	/** 最大重试次数，默认 2（仅对网络错误 / 5xx 生效，不重试 4xx） */
	maxRetries?: number
}

/** 防止多个请求同时触发 refresh */
let refreshPromise: Promise<boolean> | null = null

/** 离线提示去重 */
let offlineToastShown = false

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

function isRetryable(error: unknown): boolean {
	if (!error || typeof error !== 'object') return true // 网络错误
	const status = (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode
	if (!status) return true // 网络断连
	return status >= 500 // 仅重试服务端错误
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useAuthFetch<T = unknown>(url: string, options: AuthFetchOptions = {}) {
	const authStore = useAuthStore()
	const { maxRetries = 2, ...fetchOptions } = options as AuthFetchOptions & Record<string, unknown>

	async function execute(attempt: number): Promise<T> {
		// 离线检测
		if (import.meta.client && !navigator.onLine) {
			if (!offlineToastShown) {
				offlineToastShown = true
				ElMessage.warning('当前网络不可用，请检查网络连接')
				setTimeout(() => { offlineToastShown = false }, 5000)
			}
			throw new Error('Network offline')
		}

		try {
			return await $fetch(url, {
				...(fetchOptions as FetchOptions),
				headers: {
					...(fetchOptions as FetchOptions)?.headers,
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
								return
							}
						}

						authStore.clearSession()
						ElMessage.error('登录已过期，请重新登录')
						await navigateTo('/login')
					}
				}
			})
		} catch (error) {
			// 不重试 4xx（包括 401 已在 onResponseError 中处理）
			if (attempt < maxRetries && isRetryable(error)) {
				const delay = Math.min(1000 * Math.pow(2, attempt), 4000)
				await sleep(delay)
				return execute(attempt + 1)
			}
			throw error
		}
	}

	return execute(0)
}
