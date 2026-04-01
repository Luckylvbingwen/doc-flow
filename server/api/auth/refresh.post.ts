/**
 * POST /api/auth/refresh
 * 使用 refreshToken 换取新的 accessToken
 */
import { z } from 'zod'

const refreshSchema = z.object({
	refreshToken: z.string().min(1, 'refreshToken 不能为空'),
})

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, refreshSchema.parse)

	try {
		const payload = await verifyRefreshToken(body.refreshToken)

		// 签发新的 accessToken
		const accessToken = await signToken({
			uid: payload.uid,
			name: payload.name,
			email: payload.email,
		})

		const config = useRuntimeConfig(event)
		const expiresIn = parseExpiresIn(config.jwtExpiresIn || '15m')

		return ok({
			token: accessToken,
			tokenType: 'Bearer' as const,
			expiresIn,
		}, 'Token 刷新成功')
	} catch {
		return fail(event, 401, 'AUTH_REFRESH_INVALID', 'Refresh token 无效或已过期，请重新登录')
	}
})
