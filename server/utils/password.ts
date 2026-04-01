import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/** 将明文密码哈希 */
export function hashPassword(plain: string): Promise<string> {
	return bcrypt.hash(plain, SALT_ROUNDS)
}

/** 校验明文密码是否与哈希匹配 */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
	return bcrypt.compare(plain, hash)
}
