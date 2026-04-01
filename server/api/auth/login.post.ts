import { prisma } from '~/server/utils/prisma'
import { signToken, signRefreshToken, parseExpiresIn } from '~/server/utils/jwt'
import { verifyCaptcha } from '~/server/utils/captcha'
import { loginBodySchema } from '~/server/schemas/auth'

interface LoginUserRow {
	id: bigint | number
	name: string
	email: string | null
	feishu_open_id: string
	avatar_url: string | null
	password_hash: string | null
}

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, loginBodySchema.parse)
	const account = body.account.trim()
	const password = body.password.trim()

	// 验证码校验
	const captchaResult = verifyCaptcha(body.captchaClicks, body.captchaToken)
	if (!captchaResult.valid) {
		return fail(event, 400, 'CAPTCHA_INVALID', captchaResult.message)
	}

	const config = useRuntimeConfig(event)

	try {
		const users = await prisma.$queryRaw<LoginUserRow[]>`
      SELECT id, name, email, feishu_open_id, avatar_url, password_hash
      FROM doc_users
      WHERE deleted_at IS NULL
        AND status = 1
        AND (email = ${account} OR feishu_open_id = ${account})
      LIMIT 1
    `

		const user = users[0]
		if (!user) {
			return fail(event, 401, 'AUTH_INVALID_CREDENTIALS', '账号或密码错误')
		}

		// 密码校验：优先 bcrypt 哈希，降级到全局演示密码
		let passwordValid = false
		if (user.password_hash) {
			passwordValid = await verifyPassword(password, user.password_hash)
		} else {
			passwordValid = password === config.authDemoPassword
		}

		if (!passwordValid) {
			return fail(event, 401, 'AUTH_INVALID_CREDENTIALS', '账号或密码错误')
		}

		const userId = Number(user.id)
		const tokenPayload = { uid: userId, name: user.name, email: user.email }

		const accessToken = await signToken(tokenPayload)
		const refreshToken = await signRefreshToken(tokenPayload)

		const accessExpiresIn = parseExpiresIn(config.jwtExpiresIn || '15m')
		const refreshExpiresIn = parseExpiresIn(config.jwtRefreshExpiresIn || '7d')

		return ok({
			token: accessToken,
			refreshToken,
			tokenType: 'Bearer' as const,
			expiresIn: accessExpiresIn,
			refreshExpiresIn,
			user: {
				id: userId,
				name: user.name,
				email: user.email,
				feishuOpenId: user.feishu_open_id,
				avatar: user.avatar_url || '',
			}
		}, '登录成功')
	} catch (error) {
		const logger = useLogger('auth')
		logger.error({ err: error }, 'auth.login failed')
		return fail(event, 500, 'AUTH_INTERNAL_ERROR', '登录服务暂不可用，请稍后重试')
	}
})
