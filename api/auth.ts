import type { ApiResult } from '~/types/api'
import type { UserProfile } from '~/types/rbac'

/** 登录参数 */
export interface LoginParams {
	account: string
	password: string
}

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
	}
}

/** 登录 */
export function apiLogin(params: LoginParams) {
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
