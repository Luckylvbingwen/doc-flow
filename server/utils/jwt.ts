/**
 * JWT 工具 — 签发 / 验证 / 解析
 * 使用 jose 库，HS256 对称签名
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface JwtUserPayload extends JWTPayload {
	uid: number
	name: string
	email: string | null
}

const ALG = 'HS256'
const ISSUER = 'docflow'
const AUDIENCE = 'docflow-client'

function getSecret(): Uint8Array {
	const config = useRuntimeConfig()
	const secret = config.jwtSecret
	if (!secret || secret.length < 32) {
		throw new Error('JWT_SECRET must be at least 32 characters')
	}
	return new TextEncoder().encode(secret)
}

/**
 * 签发 JWT
 * expiresIn 格式参考 jose 文档，如 '8h'/'24h'/'7d'
 */
export async function signToken(payload: { uid: number; name: string; email: string | null }): Promise<string> {
	const config = useRuntimeConfig()
	const expiresIn = config.jwtExpiresIn || '8h'

	return new SignJWT({ uid: payload.uid, name: payload.name, email: payload.email })
		.setProtectedHeader({ alg: ALG })
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(getSecret())
}

/**
 * 验证 JWT，返回 payload
 */
export async function verifyToken(token: string): Promise<JwtUserPayload> {
	const { payload } = await jwtVerify(token, getSecret(), {
		issuer: ISSUER,
		audience: AUDIENCE
	})
	return payload as JwtUserPayload
}
