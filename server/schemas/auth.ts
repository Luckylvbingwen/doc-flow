import { z } from 'zod'

/* ── POST /api/auth/login ── */
export const loginBodySchema = z.object({
	account: z.string().min(1, '账号不能为空'),
	password: z.string().min(1, '密码不能为空'),
	captchaClicks: z.array(z.object({
		x: z.number(),
		y: z.number(),
	})),
	captchaToken: z.string().min(1, '验证码 token 不能为空'),
})
export type LoginBody = z.infer<typeof loginBodySchema>

/* ── POST /api/auth/feishu/callback ── */
export const feishuCallbackBodySchema = z.object({
	code: z.string().min(1, '缺少飞书授权 code'),
	state: z.string().min(1, '缺少飞书授权 state'),
})
export type FeishuCallbackBody = z.infer<typeof feishuCallbackBodySchema>

/* ── GET /api/auth/feishu/auth-url ── */
export const feishuAuthUrlQuerySchema = z.object({
	redirectUri: z.string().min(1, '缺少 redirectUri 参数'),
})
export type FeishuAuthUrlQuery = z.infer<typeof feishuAuthUrlQuerySchema>
