/**
 * PUT /api/auth/password
 * 修改当前用户密码
 */
import { prisma } from '~/server/utils/prisma'
import { changePasswordSchema } from '~/server/schemas/auth'
import { AUTH_REQUIRED, AUTH_OLD_PASSWORD_WRONG, AUTH_INTERNAL_ERROR } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) {
		return fail(event, 401, AUTH_REQUIRED, '请先登录')
	}

	const body = await readValidatedBody(event, changePasswordSchema.parse)
	const config = useRuntimeConfig(event)

	try {
		// 查询当前密码哈希
		const rows = await prisma.$queryRaw<{ password_hash: string | null }[]>`
			SELECT password_hash FROM doc_users WHERE id = ${user.id} AND deleted_at IS NULL LIMIT 1
		`
		const currentHash = rows[0]?.password_hash

		// 验证旧密码
		let oldPasswordValid = false
		if (currentHash) {
			oldPasswordValid = await verifyPassword(body.oldPassword, currentHash)
		} else {
			// 尚未设置个人密码，使用全局演示密码校验
			oldPasswordValid = body.oldPassword === config.authDemoPassword
		}

		if (!oldPasswordValid) {
			return fail(event, 400, AUTH_OLD_PASSWORD_WRONG, '旧密码错误')
		}

		// 哈希新密码并更新
		const newHash = await hashPassword(body.newPassword)
		await prisma.$executeRaw`
			UPDATE doc_users SET password_hash = ${newHash} WHERE id = ${user.id}
		`

		// 吊销该用户所有 refresh token
		await revokeAllUserRefreshTokens(user.id)

		return ok(null, '密码修改成功，请重新登录')
	} catch (error) {
		const logger = useLogger('auth')
		logger.error({ err: error, userId: user.id }, 'change password failed')
		return fail(event, 500, AUTH_INTERNAL_ERROR, '修改密码失败，请稍后重试')
	}
})
