/**
 * GET /api/auth/feishu/auth-url
 * 获取飞书 OAuth 授权跳转地址
 *
 * Query: redirectUri — 授权完成后的回调地址（即前端登录页 URL）
 */
import { randomBytes } from 'node:crypto'

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

export default defineEventHandler((event) => {
	const config = useRuntimeConfig(event)
	const appId = String(config.feishuAppId || '')

	if (!appId) {
		return fail(event, 500, 'FEISHU_NOT_CONFIGURED', '飞书登录未配置 App ID')
	}

	const query = getQuery(event)
	const redirectUri = String(query.redirectUri || '').trim()

	if (!redirectUri) {
		return fail(event, 400, 'PARAM_MISSING', '缺少 redirectUri 参数')
	}

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
