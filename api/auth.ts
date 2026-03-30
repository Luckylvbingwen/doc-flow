import type { ApiResult } from '~/types/api'
import type { UserProfile } from '~/types/rbac'
import type { LoginBody, FeishuCallbackBody } from '~/server/schemas/auth'

/** 登录返回 data */
export interface LoginResult {
	token: string
	tokenType: 'Bearer'
	expiresIn: number
	user: {
		id: number
		name: string
		email: string | null
		feishuOpenId: string
		avatar: string
	}
}

/** 登录 */
export function apiLogin(params: LoginBody) {
	return $fetch<ApiResult<LoginResult>>('/api/auth/login', {
		method: 'POST',
		body: params,
	})
}

/** 登出 */
export function apiLogout() {
	return useAuthFetch<ApiResult>('/api/auth/logout', { method: 'POST' })
}

/** 获取当前用户信息（含角色与权限） */
export function apiGetProfile(token: string, tokenType = 'Bearer') {
	return $fetch<ApiResult<UserProfile>>('/api/auth/me', {
		headers: { Authorization: `${tokenType} ${token}` },
	})
}

// ================================================================
//  飞书 OAuth
// ================================================================

/** 获取飞书授权跳转 URL */
export function apiFeishuAuthUrl(redirectUri: string) {
	return $fetch<ApiResult<{ authUrl: string; state: string }>>('/api/auth/feishu/auth-url', {
		query: { redirectUri },
	})
}

/** 飞书 OAuth 回调 */
export function apiFeishuCallback(params: FeishuCallbackBody) {
	return $fetch<ApiResult<LoginResult>>('/api/auth/feishu/callback', {
		method: 'POST',
		body: params,
	})
}
