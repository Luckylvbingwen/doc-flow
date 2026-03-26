/**
 * 飞书开放平台 API 工具
 *
 * 参考 task-platform/app/common/library/Feishu.php 翻译为 TypeScript 版本。
 * 功能：tenant_access_token 缓存管理、消息发送（文本 / 交互卡片）。
 *
 * 飞书开放平台文档：https://open.feishu.cn/document/server-docs
 */

const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis'

/** token 缓存（进程内存级，简单够用；多实例部署可换 Redis） */
let tokenCache: { token: string; expiresAt: number } | null = null

// ================================================================
//  Token
// ================================================================

/**
 * 获取 tenant_access_token（自建应用模式）
 * 有效期 2h，提前 5 分钟过期刷新
 */
export async function getFeishuTenantToken(): Promise<string> {
	if (tokenCache && Date.now() < tokenCache.expiresAt) {
		return tokenCache.token
	}

	const config = useRuntimeConfig()
	const appId = String(config.feishuAppId || '')
	const appSecret = String(config.feishuAppSecret || '')

	if (!appId || !appSecret) {
		throw new Error('飞书 App ID / App Secret 未配置')
	}

	const res = await $fetch<{
		code: number
		msg: string
		tenant_access_token: string
		expire: number
	}>(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
		method: 'POST',
		body: { app_id: appId, app_secret: appSecret },
	})

	if (res.code !== 0) {
		throw new Error(`获取 tenant_access_token 失败: ${res.msg}`)
	}

	const expireMs = (res.expire - 300) * 1000 // 提前 5 分钟过期
	tokenCache = {
		token: res.tenant_access_token,
		expiresAt: Date.now() + Math.max(expireMs, 60_000),
	}

	return tokenCache.token
}

// ================================================================
//  通用请求
// ================================================================

interface FeishuApiResponse {
	code: number
	msg: string
	data?: Record<string, unknown>
}

/** 带鉴权的 GET 请求 */
export async function feishuGet<T = Record<string, unknown>>(
	path: string,
	query?: Record<string, string>,
): Promise<T> {
	const token = await getFeishuTenantToken()

	try {
		const res = await $fetch<FeishuApiResponse>(
			`${FEISHU_BASE_URL}${path}`,
			{
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
				query,
			},
		)

		if (res.code !== 0) {
			throw new Error(`飞书 API [${path}]: code=${res.code} ${res.msg}`)
		}

		return (res.data ?? {}) as T
	} catch (err: unknown) {
		const fetchErr = err as { data?: { code?: number; msg?: string }; statusCode?: number }
		if (fetchErr?.data?.code !== undefined) {
			throw new Error(`飞书 API [${path}] HTTP ${fetchErr.statusCode}: code=${fetchErr.data.code} ${fetchErr.data.msg || ''}`)
		}
		throw err
	}
}

/** 带鉴权的 POST 请求 */
export async function feishuPost<T = Record<string, unknown>>(
	path: string,
	body?: Record<string, unknown>,
	query?: Record<string, string>,
): Promise<T> {
	const token = await getFeishuTenantToken()

	try {
		const res = await $fetch<FeishuApiResponse>(
			`${FEISHU_BASE_URL}${path}`,
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body,
				query,
			},
		)

		if (res.code !== 0) {
			throw new Error(`飞书 API [${path}]: code=${res.code} ${res.msg}`)
		}

		return (res.data ?? {}) as T
	} catch (err: unknown) {
		const fetchErr = err as { data?: { code?: number; msg?: string }; statusCode?: number }
		if (fetchErr?.data?.code !== undefined) {
			throw new Error(`飞书 API [${path}] HTTP ${fetchErr.statusCode}: code=${fetchErr.data.code} ${fetchErr.data.msg || ''}`)
		}
		throw err
	}
}

// ================================================================
//  消息发送
// ================================================================

/**
 * 发送飞书机器人消息
 *
 * @param receiveId  接收者 ID（open_id / user_id / chat_id）
 * @param msgType    消息类型: text / interactive / post 等
 * @param content    消息内容 JSON 字符串
 * @param receiveIdType 接收者类型，默认 open_id
 */
export async function feishuSendMessage(
	receiveId: string,
	msgType: string,
	content: string,
	receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id' = 'open_id',
) {
	return feishuPost(
		'/im/v1/messages',
		{
			receive_id: receiveId,
			msg_type: msgType,
			content,
		},
		{ receive_id_type: receiveIdType },
	)
}

/** 发送纯文本消息 */
export async function feishuSendText(openId: string, text: string) {
	return feishuSendMessage(
		openId,
		'text',
		JSON.stringify({ text }),
	)
}

/** 发送交互卡片消息 */
export async function feishuSendCard(openId: string, card: Record<string, unknown>) {
	return feishuSendMessage(
		openId,
		'interactive',
		JSON.stringify(card),
	)
}

// ================================================================
//  OAuth — 授权码换 token + 获取用户信息
// ================================================================

interface FeishuOAuthTokenResponse {
	code: number
	msg: string
	data: {
		access_token: string
		token_type: string
		expires_in: number
		refresh_token: string
	}
}

interface FeishuUserInfo {
	code: number
	msg: string
	data: {
		open_id: string
		union_id: string
		user_id: string
		name: string
		avatar_url: string
		email?: string
		mobile?: string
	}
}

/**
 * 飞书 OAuth 授权码换取用户信息
 * 流程：app_access_token → user_access_token → user_info
 */
export async function feishuCodeToUser(code: string) {
	const config = useRuntimeConfig()
	const appId = String(config.feishuAppId || '')
	const appSecret = String(config.feishuAppSecret || '')

	// 第一步：获取 app_access_token
	const appTokenRes = await $fetch<{
		code: number
		msg: string
		app_access_token: string
	}>(`${FEISHU_BASE_URL}/auth/v3/app_access_token/internal`, {
		method: 'POST',
		body: { app_id: appId, app_secret: appSecret },
	})

	if (appTokenRes.code !== 0 || !appTokenRes.app_access_token) {
		throw new Error(`获取飞书 app_access_token 失败: ${appTokenRes.msg}`)
	}

	// 第二步：用授权码换取 user_access_token
	const tokenRes = await $fetch<FeishuOAuthTokenResponse>(
		`${FEISHU_BASE_URL}/authen/v1/oidc/access_token`,
		{
			method: 'POST',
			headers: { Authorization: `Bearer ${appTokenRes.app_access_token}` },
			body: { grant_type: 'authorization_code', code },
		},
	)

	if (tokenRes.code !== 0 || !tokenRes.data?.access_token) {
		throw new Error(`飞书换取 access_token 失败: ${tokenRes.msg}`)
	}

	// 第三步：获取用户信息
	const userRes = await $fetch<FeishuUserInfo>(
		`${FEISHU_BASE_URL}/authen/v1/user_info`,
		{
			method: 'GET',
			headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
		},
	)

	if (userRes.code !== 0) {
		throw new Error(`获取飞书用户信息失败: ${userRes.msg}`)
	}

	return {
		openId: userRes.data.open_id || '',
		unionId: userRes.data.union_id || '',
		userId: userRes.data.user_id || '',
		name: userRes.data.name || '',
		avatarUrl: userRes.data.avatar_url || '',
		email: userRes.data.email || '',
		mobile: userRes.data.mobile || '',
	}
}
