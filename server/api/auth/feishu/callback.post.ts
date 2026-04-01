/**
 * POST /api/auth/feishu/callback
 * 飞书 OAuth 回调 — 授权码换取用户信息并签发 JWT
 *
 * Body: { code: string, state: string }
 *
 * 流程（对标 task-platform）：
 * 1. 校验 state 防 CSRF
 * 2. code → app_access_token → user_access_token → user_info
 * 3. 通过 open_id 查 doc_feishu_users → 关联的 doc_users
 * 4. 如果 doc_feishu_users 没有记录则自动写入（首次登录）
 * 5. 如果没有关联的 doc_users 则自动创建系统用户
 * 6. 签发 JWT，返回与密码登录相同的 session 结构
 */
import { prisma } from '~/server/utils/prisma'
import { signToken, signRefreshToken, parseExpiresIn } from '~/server/utils/jwt'
import { stateCache } from './auth-url.get'
import { feishuCallbackBodySchema } from '~/server/schemas/auth'
import type { DocUserRow } from '~/server/types/auth'
import { FEISHU_STATE_EXPIRED, FEISHU_USER_EMPTY, FEISHU_LOGIN_ERROR } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, feishuCallbackBodySchema.parse)
	const code = body.code.trim()
	const state = body.state.trim()

	// 校验 state
	const stateExpiry = stateCache.get(state)
	if (!stateExpiry || Date.now() > stateExpiry) {
		return fail(event, 400, FEISHU_STATE_EXPIRED, '飞书授权状态已失效，请重试')
	}
	stateCache.delete(state)

	try {
		// 飞书授权码换取用户信息
		const feishuUser = await feishuCodeToUser(code)

		if (!feishuUser.openId) {
			return fail(event, 400, FEISHU_USER_EMPTY, '飞书用户标识为空，无法完成登录')
		}

		// ── Step 1: 查/写 doc_feishu_users ──
		let feishuRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
			'SELECT id FROM doc_feishu_users WHERE feishu_open_id = ? LIMIT 1',
			feishuUser.openId,
		)

		let feishuDbId: number

		if (feishuRows.length > 0) {
			feishuDbId = Number(feishuRows[0].id)
			// 更新最新信息
			await prisma.$executeRawUnsafe(
				`UPDATE doc_feishu_users SET nickname = ?, email = ?, avatar = ?,
					feishu_union_id = ?, feishu_user_id = ? WHERE id = ?`,
				feishuUser.name, feishuUser.email || null, feishuUser.avatarUrl || null,
				feishuUser.unionId, feishuUser.userId, feishuDbId,
			)
		} else {
			// 首次登录，自动写入 doc_feishu_users
			await prisma.$executeRawUnsafe(
				`INSERT INTO doc_feishu_users
					(username, nickname, email, avatar, status,
					 feishu_open_id, feishu_union_id, feishu_user_id)
				 VALUES (?, ?, ?, ?, 'normal', ?, ?, ?)`,
				feishuUser.name, feishuUser.name,
				feishuUser.email || null, feishuUser.avatarUrl || null,
				feishuUser.openId, feishuUser.unionId, feishuUser.userId,
			)
			feishuRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
				'SELECT id FROM doc_feishu_users WHERE feishu_open_id = ? LIMIT 1',
				feishuUser.openId,
			)
			feishuDbId = Number(feishuRows[0].id)
		}

		// ── Step 2: 查关联的 doc_users ──
		let users = await prisma.$queryRawUnsafe<DocUserRow[]>(
			`SELECT id, name, email, feishu_open_id, avatar_url FROM doc_users
			 WHERE deleted_at IS NULL AND status = 1 AND feishu_user_id = ? LIMIT 1`,
			feishuDbId,
		)

		// 兼容：也查 feishu_open_id 直接匹配（兼容旧数据）
		if (users.length === 0) {
			users = await prisma.$queryRawUnsafe<DocUserRow[]>(
				`SELECT id, name, email, feishu_open_id, avatar_url FROM doc_users
				 WHERE deleted_at IS NULL AND status = 1 AND feishu_open_id = ? LIMIT 1`,
				feishuUser.openId,
			)
			// 如果通过 open_id 匹配到了，补上 feishu_user_id 关联
			if (users.length > 0) {
				await prisma.$executeRawUnsafe(
					'UPDATE doc_users SET feishu_user_id = ? WHERE id = ?',
					feishuDbId, Number(users[0].id),
				)
			}
		}

		let user: DocUserRow

		if (users.length > 0) {
			user = users[0]
		} else {
			// ── Step 3: 自动创建系统用户 ──
			const newId = Date.now()
			await prisma.$executeRawUnsafe(
				`INSERT INTO doc_users (id, feishu_open_id, feishu_union_id, feishu_user_id,
					name, email, avatar_url, status)
				 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
				newId, feishuUser.openId, feishuUser.unionId, feishuDbId,
				feishuUser.name, feishuUser.email || null, feishuUser.avatarUrl || null,
			)
			user = {
				id: newId,
				name: feishuUser.name,
				email: feishuUser.email || null,
				feishu_open_id: feishuUser.openId,
				avatar_url: feishuUser.avatarUrl || null,
			}
		}

		// ── Step 4: 签发 JWT ──
		const userId = Number(user.id)
		const tokenPayload = { uid: userId, name: user.name, email: user.email }

		const accessToken = await signToken(tokenPayload)
		const refreshToken = await signRefreshToken(tokenPayload)

		const config = useRuntimeConfig(event)
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
				avatar: user.avatar_url || feishuUser.avatarUrl || '',
			},
		}, '飞书登录成功')
	} catch (error) {
		const logger = useLogger('auth')
		logger.error({ err: error }, 'feishu.callback failed')
		const msg = error instanceof Error ? error.message : '飞书登录失败'
		return fail(event, 500, FEISHU_LOGIN_ERROR, msg)
	}
})
