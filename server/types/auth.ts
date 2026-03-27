/**
 * 认证模块 — 服务端 DB 行类型 & 请求体类型
 */
import type { ClickPoint } from '~/server/utils/captcha'

/** 登录请求体 */
export type LoginBody = {
	account?: string
	password?: string
	captchaClicks?: ClickPoint[]
	captchaToken?: string
}

/** doc_users 查询行（登录/回调共用） */
export type DocUserRow = {
	id: bigint | number
	name: string
	email: string | null
	feishu_open_id: string
	avatar_url: string | null
}

/** 飞书回调请求体 */
export type CallbackBody = {
	code?: string
	state?: string
}

/** me 接口 — 角色查询行 */
export interface MeRoleRow {
	id: bigint | number
	code: string
	name: string
}
