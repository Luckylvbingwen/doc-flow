/**
 * 服务端 API 鉴权中间件
 * - 拦截 /api/** 请求（排除 /api/auth/** 和 /api/health）
 * - 验证 Authorization: Bearer <jwt>
 * - 将用户信息注入 event.context.user
 */
export default defineEventHandler(async (event) => {
	const path = getRequestURL(event).pathname

	// 白名单：不需要鉴权的接口
	if (
		path.startsWith('/api/auth/') ||
		path === '/api/health' ||
		!path.startsWith('/api/')
	) {
		return
	}

	const authHeader = getRequestHeader(event, 'authorization')
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		setResponseStatus(event, 401)
		return {
			success: false,
			code: 'AUTH_TOKEN_MISSING',
			message: '未提供有效的认证令牌'
		}
	}

	const token = authHeader.slice(7)

	try {
		const payload = await verifyToken(token)
		// 注入用户信息到 event context，后续 handler 可通过 event.context.user 获取
		event.context.user = {
			id: payload.uid,
			name: payload.name,
			email: payload.email
		}
	} catch {
		setResponseStatus(event, 401)
		return {
			success: false,
			code: 'AUTH_TOKEN_INVALID',
			message: '认证令牌无效或已过期'
		}
	}
})
