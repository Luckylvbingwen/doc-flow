/**
 * 统一 API 响应结构
 */

/** 成功响应 */
export interface ApiResponse<T = unknown> {
	success: true
	code: 'OK'
	message: string
	data: T
}

/** 失败响应 */
export interface ApiError {
	success: false
	code: string
	message: string
}

/** 通用响应（成功 | 失败） */
export type ApiResult<T = unknown> = ApiResponse<T> | ApiError

/** 分页数据包装 */
export interface PaginatedData<T> {
	list: T[]
	total: number
	page: number
	pageSize: number
}

/** 分页响应快捷类型 */
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>

/** 认证用户信息（前端通用） */
export interface AuthUser {
	id: number
	name: string
	email: string | null
	feishuOpenId: string
	avatar: string
}

/** 登录响应 data */
export interface LoginData {
	token: string
	refreshToken: string
	tokenType: 'Bearer'
	expiresIn: number
	refreshExpiresIn: number
	user: AuthUser
}

/** 前端会话结构（localStorage 持久化） */
export interface AuthSession {
	token: string
	refreshToken: string
	tokenType: 'Bearer'
	expiresIn: number
	refreshExpiresIn: number
	user: AuthUser
}

/** 角色简要信息 */
export interface AuthRole {
	id: number
	code: string
	name: string
}

/** 验证码数据（GET /api/auth/captcha 返回） */
export interface CaptchaData {
	svg: string
	token: string
	prompt: string
	width: number
	height: number
}
