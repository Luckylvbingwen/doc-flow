import { prisma } from '../../utils/prisma'

type LoginBody = {
	account?: string
	password?: string
}

type LoginUserRow = {
	id: bigint | number
	name: string
	email: string | null
	feishu_open_id: string
}

const UNAUTHORIZED_STATUS = 401
const BAD_REQUEST_STATUS = 400
const INTERNAL_ERROR_STATUS = 500

export default defineEventHandler(async (event) => {
	const body = await readBody<LoginBody>(event)
	const account = body.account?.trim() || ''
	const password = body.password?.trim() || ''

	if (!account || !password) {
		setResponseStatus(event, BAD_REQUEST_STATUS)
		return {
			success: false,
			code: 'AUTH_INVALID_PARAMS',
			message: '账号和密码不能为空'
		}
	}

	const config = useRuntimeConfig(event)
	const expectedPassword = config.authDemoPassword

	try {
		const users = await prisma.$queryRaw<LoginUserRow[]>`
      SELECT id, name, email, feishu_open_id
      FROM doc_users
      WHERE deleted_at IS NULL
        AND status = 1
        AND (email = ${account} OR feishu_open_id = ${account})
      LIMIT 1
    `

		const user = users[0]
		if (!user || password !== expectedPassword) {
			setResponseStatus(event, UNAUTHORIZED_STATUS)
			return {
				success: false,
				code: 'AUTH_INVALID_CREDENTIALS',
				message: '账号或密码错误'
			}
		}

		const userId = Number(user.id)
		const token = `docflow_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

		return {
			success: true,
			code: 'OK',
			message: '登录成功',
			data: {
				token,
				tokenType: 'Bearer',
				expiresIn: 86400,
				user: {
					id: userId,
					name: user.name,
					email: user.email,
					feishuOpenId: user.feishu_open_id
				}
			}
		}
	} catch (error) {
		console.error('auth.login failed:', error)
		setResponseStatus(event, INTERNAL_ERROR_STATUS)
		return {
			success: false,
			code: 'AUTH_INTERNAL_ERROR',
			message: '登录服务暂不可用，请稍后重试'
		}
	}
})
