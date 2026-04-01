/**
 * GET /api/auth/feishu/auth-url
 * 获取飞书 OAuth 授权跳转地址
 *
 * Query: redirectUri — 授权完成后的回调地址（即前端登录页 URL）
 */
import { randomBytes } from 'node:crypto'
import { feishuAuthUrlQuerySchema } from '~/server/schemas/auth'
import { FEISHU_NOT_CONFIGURED } from '~/server/constants/error-codes'

/** OAuth state 缓存（5 分钟有效） */
const stateCache = new Map<string, number>()

/** 定期清理过期 state */
setInterval(() => {
	const now = Date.now()
	for (const [key, expiresAt] of stateCache) {
		if (now > expiresAt) stateCache.delete(key)
	}
}, 60_000)

export { stateCache }

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig(event)
	const appId = String(config.feishuAppId || '')

	if (!appId) {
		return fail(event, 500, FEISHU_NOT_CONFIGURED, '飞书登录未配置 App ID')
	}

	const query = await getValidatedQuery(event, feishuAuthUrlQuerySchema.parse)
	const redirectUri = query.redirectUri.trim()

	// 生成防 CSRF 的 state 参数
	const state = randomBytes(16).toString('hex')
	stateCache.set(state, Date.now() + 300_000) // 5 分钟有效

	const authUrl = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize?'
		+ new URLSearchParams({
			app_id: appId,
			redirect_uri: redirectUri,
			response_type: 'code',
			state,
		}).toString()

	return ok({ authUrl, state })
})
