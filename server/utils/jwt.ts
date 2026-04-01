/**
 * JWT 工具 — 签发 / 验证 / 解析 / 吊销
 * 使用 jose 库，HS256 对称签名
 * 支持 accessToken（短期）+ refreshToken（长期）双令牌模式
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface JwtUserPayload extends JWTPayload {
	uid: number
	name: string
	email: string | null
	type?: 'access' | 'refresh'
}

const ALG = 'HS256'
const ISSUER = 'docflow'
const AUDIENCE = 'docflow-client'
const REFRESH_AUDIENCE = 'docflow-refresh'

/** Redis key 前缀 */
const BLOCKLIST_PREFIX = 'jwt:blocklist:'
const USER_REFRESH_PREFIX = 'jwt:user-refresh:'

function getSecret(): Uint8Array {
	const config = useRuntimeConfig()
	const secret = config.jwtSecret
	if (!secret || secret.length < 32) {
		throw new Error('JWT_SECRET must be at least 32 characters')
	}
	return new TextEncoder().encode(secret)
}

/** 将 '8h'/'24h'/'7d'/'15m' 格式转为秒数 */
export function parseExpiresIn(value: string): number {
	const match = value.match(/^(\d+)(h|d|m|s)$/)
	if (!match) return 900 // 默认 15m
	const num = parseInt(match[1], 10)
	const unit = match[2]
	if (unit === 's') return num
	if (unit === 'm') return num * 60
	if (unit === 'h') return num * 3600
	if (unit === 'd') return num * 86400
	return 900
}

/**
 * 签发 accessToken（短期）
 */
export async function signToken(payload: { uid: number; name: string; email: string | null }): Promise<string> {
	const config = useRuntimeConfig()
	const expiresIn = config.jwtExpiresIn || '15m'

	return new SignJWT({ uid: payload.uid, name: payload.name, email: payload.email, type: 'access' })
		.setProtectedHeader({ alg: ALG })
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(getSecret())
}

/**
 * 签发 refreshToken（长期）
 */
export async function signRefreshToken(payload: { uid: number; name: string; email: string | null }): Promise<string> {
	const config = useRuntimeConfig()
	const expiresIn = config.jwtRefreshExpiresIn || '7d'

	const token = await new SignJWT({ uid: payload.uid, name: payload.name, email: payload.email, type: 'refresh' })
		.setProtectedHeader({ alg: ALG })
		.setIssuer(ISSUER)
		.setAudience(REFRESH_AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(getSecret())

	// 将 refresh token 关联到用户（用于改密时批量吊销）
	const redis = getRedis()
	if (redis) {
		const ttl = parseExpiresIn(expiresIn)
		await redis.sadd(`${USER_REFRESH_PREFIX}${payload.uid}`, token)
		await redis.expire(`${USER_REFRESH_PREFIX}${payload.uid}`, ttl)
	}

	return token
}

/**
 * 验证 accessToken，返回 payload
 */
export async function verifyToken(token: string): Promise<JwtUserPayload> {
	const { payload } = await jwtVerify(token, getSecret(), {
		issuer: ISSUER,
		audience: AUDIENCE,
	})
	return payload as JwtUserPayload
}

/**
 * 验证 refreshToken，返回 payload
 * 同时检查是否在 blocklist 中
 */
export async function verifyRefreshToken(token: string): Promise<JwtUserPayload> {
	// 先检查 blocklist
	const blocked = await isTokenBlocked(token)
	if (blocked) {
		throw new Error('Refresh token has been revoked')
	}

	const { payload } = await jwtVerify(token, getSecret(), {
		issuer: ISSUER,
		audience: REFRESH_AUDIENCE,
	})
	return payload as JwtUserPayload
}

/**
 * 将 refresh token 加入 blocklist（登出时调用）
 */
export async function revokeRefreshToken(token: string): Promise<void> {
	const redis = getRedis()
	if (!redis) return

	try {
		// 解析 token 获取剩余有效期
		const { payload } = await jwtVerify(token, getSecret(), {
			issuer: ISSUER,
			audience: REFRESH_AUDIENCE,
		})
		const exp = payload.exp || 0
		const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 0)
		if (ttl > 0) {
			await redis.set(`${BLOCKLIST_PREFIX}${token}`, '1', 'EX', ttl)
		}
	} catch {
		// token 已过期，无需加 blocklist
	}
}

/**
 * 吊销某用户的所有 refresh token（改密时调用）
 */
export async function revokeAllUserRefreshTokens(userId: number): Promise<void> {
	const redis = getRedis()
	if (!redis) return

	const key = `${USER_REFRESH_PREFIX}${userId}`
	const tokens = await redis.smembers(key)

	if (tokens.length > 0) {
		const pipeline = redis.pipeline()
		for (const token of tokens) {
			// 给每个 token 7 天 blocklist TTL（与 refresh token 最大有效期一致）
			pipeline.set(`${BLOCKLIST_PREFIX}${token}`, '1', 'EX', 7 * 86400)
		}
		pipeline.del(key)
		await pipeline.exec()
	}
}

/**
 * 检查 token 是否在 blocklist 中
 */
async function isTokenBlocked(token: string): Promise<boolean> {
	const redis = getRedis()
	if (!redis) return false

	const result = await redis.exists(`${BLOCKLIST_PREFIX}${token}`)
	return result === 1
}
