/**
 * POST /api/auth/feishu/callback
 * 飞书 OAuth 回调 — 授权码换取用户信息并签发 JWT
 *
 * Body: { code: string, state: string }
 *
 * 流程：
 * 1. 校验 state 防 CSRF
 * 2. code → app_access_token → user_access_token → user_info
 * 3. 按 feishu_open_id upsert doc_feishu_users
 * 4. 按 feishu_open_id 查 doc_users（通常已由 feishuSyncContacts 预落地），无则兜底建档
 * 5. 签发 JWT，返回与密码登录相同的 session 结构
 *
 * 关联字段：doc_users.feishu_open_id ↔ doc_feishu_users.feishu_open_id（天然一致）
 */
import { prisma } from '~/server/utils/prisma'
import { signToken, signRefreshToken, parseExpiresIn } from '~/server/utils/jwt'
import { generateId } from '~/server/utils/snowflake'
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

		// ── Step 1: upsert doc_feishu_users（按 feishu_open_id 幂等） ──
		const feishuRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
			'SELECT id FROM doc_feishu_users WHERE feishu_open_id = ? LIMIT 1',
			feishuUser.openId,
		)

		if (feishuRows.length > 0) {
			await prisma.$executeRawUnsafe(
				`UPDATE doc_feishu_users SET nickname = ?, email = ?, avatar = ?,
					feishu_union_id = ?, feishu_user_id = ? WHERE id = ?`,
				feishuUser.name, feishuUser.email || null, feishuUser.avatarUrl || null,
				feishuUser.unionId, feishuUser.userId, Number(feishuRows[0].id),
			)
		} else {
			// 首次登录兜底：通常已由 feishuSyncContacts 预落地
			await prisma.$executeRawUnsafe(
				`INSERT INTO doc_feishu_users
					(username, nickname, email, avatar, status,
					 feishu_open_id, feishu_union_id, feishu_user_id)
				 VALUES (?, ?, ?, ?, 'normal', ?, ?, ?)`,
				feishuUser.name, feishuUser.name,
				feishuUser.email || null, feishuUser.avatarUrl || null,
				feishuUser.openId, feishuUser.unionId, feishuUser.userId,
			)
		}

		// ── Step 2: 按 feishu_open_id 查 doc_users ──
		const users = await prisma.$queryRawUnsafe<DocUserRow[]>(
			`SELECT id, name, email, feishu_open_id, avatar_url FROM doc_users
			 WHERE deleted_at IS NULL AND status = 1 AND feishu_open_id = ? LIMIT 1`,
			feishuUser.openId,
		)

		let user: DocUserRow

		if (users.length > 0) {
			user = users[0]
		} else {
			// ── Step 3: 兜底建档（通常已由 feishuSyncContacts 预落地，此处防御首次登录前未跑同步） ──
			const newId = generateId()
			await prisma.$executeRawUnsafe(
				`INSERT INTO doc_users (id, feishu_open_id, feishu_union_id,
					name, email, avatar_url, status)
				 VALUES (?, ?, ?, ?, ?, ?, 1)`,
				newId, feishuUser.openId, feishuUser.unionId,
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
