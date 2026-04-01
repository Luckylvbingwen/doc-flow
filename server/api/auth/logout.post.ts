/**
 * POST /api/auth/logout
 * 登出：将 refreshToken 加入 blocklist
 */
export default defineEventHandler(async (event) => {
	const body = await readBody(event).catch(() => ({} as Record<string, unknown>))
	const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''

	// 如果提供了 refreshToken，加入 blocklist
	if (refreshToken) {
		await revokeRefreshToken(refreshToken)
	}

	return ok(null, '退出登录成功')
})
