/**
 * 数据库错误判断工具
 * 支持 Prisma P2002 和 MySQL ER_DUP_ENTRY 两种唯一约束冲突格式
 */

export function isDuplicateKeyError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false

	const err = error as Record<string, unknown>

	// Prisma 唯一约束错误
	if (err.code === 'P2002') return true

	// MySQL 原生错误（通过 $executeRaw 抛出）
	if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) return true

	return false
}
