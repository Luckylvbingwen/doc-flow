import { prisma } from '../../utils/prisma'
import { signToken } from '../../utils/jwt'
import { verifyCaptcha, type ClickPoint } from '../../utils/captcha'

/** 将 '8h'/'24h'/'7d' 格式转为秒数 */
function parseExpiresIn(value: string): number {
	const match = value.match(/^(\d+)(h|d|m|s)$/)
	if (!match) return 28800 // 默认 8h
	const num = parseInt(match[1], 10)
	const unit = match[2]
	if (unit === 's') return num
	if (unit === 'm') return num * 60
	if (unit === 'h') return num * 3600
	if (unit === 'd') return num * 86400
	return 28800
}

type LoginBody = {
	account?: string
	password?: string
	captchaClicks?: ClickPoint[]
	captchaToken?: string
}

type LoginUserRow = {
	id: bigint | number
	name: string
	email: string | null
	feishu_open_id: string
	avatar_url: string | null
}

export default defineEventHandler(async (event) => {
	const body = await readBody<LoginBody>(event)
	const account = body.account?.trim() || ''
	const password = body.password?.trim() || ''

	if (!account || !password) {
		return fail(event, 400, 'AUTH_INVALID_PARAMS', '账号和密码不能为空')
	}

	// 验证码校验
	const captchaResult = verifyCaptcha(body.captchaClicks || [], body.captchaToken || '')
	if (!captchaResult.valid) {
		return fail(event, 400, 'CAPTCHA_INVALID', captchaResult.message)
	}

	const config = useRuntimeConfig(event)
	const expectedPassword = config.authDemoPassword

	try {
		const users = await prisma.$queryRaw<LoginUserRow[]>`
      SELECT id, name, email, feishu_open_id, avatar_url
      FROM doc_users
      WHERE deleted_at IS NULL
        AND status = 1
        AND (email = ${account} OR feishu_open_id = ${account})
      LIMIT 1
    `

		const user = users[0]
		if (!user || password !== expectedPassword) {
			return fail(event, 401, 'AUTH_INVALID_CREDENTIALS', '账号或密码错误')
		}

		const userId = Number(user.id)
		const token = await signToken({
			uid: userId,
			name: user.name,
			email: user.email
		})

		// 过期秒数与 JWT 配置保持一致
		const jwtExpiresIn = config.jwtExpiresIn || '8h'
		const expiresInSeconds = parseExpiresIn(jwtExpiresIn)

		return ok({
			token,
			tokenType: 'Bearer' as const,
			expiresIn: expiresInSeconds,
			user: {
				id: userId,
				name: user.name,
				email: user.email,
				feishuOpenId: user.feishu_open_id,
				avatar: user.avatar_url || '',
			}
		}, '登录成功')
	} catch (error) {
		console.error('auth.login failed:', error)
		return fail(event, 500, 'AUTH_INTERNAL_ERROR', '登录服务暂不可用，请稍后重试')
	}
})
