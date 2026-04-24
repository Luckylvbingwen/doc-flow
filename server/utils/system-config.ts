/**
 * 全局配置读取 helper（doc_system_config 表）
 *
 * 设计：
 *   - 进程内 Map 缓存，TTL 5 分钟，避免每个业务调用都打 DB
 *   - 缓存 miss 或过期 → 查 DB → 写缓存
 *   - 配置 key 不存在 → 返回 defaultValue 但**不写缓存**（避免空值污染，管理后台后续写入新键可立即生效）
 *   - DB 异常 → 返回 defaultValue + pino warn（cron 等后台任务不应因配置读取失败整体挂掉）
 *
 * 用例：
 *   const hours = await getSystemConfigNumber('approval_timeout_hours', 24)
 *   const maxRemind = await getSystemConfigNumber('remind_max_count', 3)
 *
 * 未来：管理后台编辑配置后调用 invalidateSystemConfigCache(key) 强制下次读 DB
 */
import { prisma } from '~/server/utils/prisma'
import { useLogger } from '~/server/utils/logger'

interface CacheEntry {
	value: string
	expireAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, CacheEntry>()

export async function getSystemConfig(key: string, defaultValue: string): Promise<string> {
	const now = Date.now()
	const hit = cache.get(key)
	if (hit && hit.expireAt > now) return hit.value

	try {
		const row = await prisma.doc_system_config.findUnique({
			where: { config_key: key },
			select: { config_value: true },
		})
		if (row == null) return defaultValue
		cache.set(key, { value: row.config_value, expireAt: now + CACHE_TTL_MS })
		return row.config_value
	} catch (err) {
		useLogger('system-config').warn({ err, key }, 'getSystemConfig failed, fallback to default')
		return defaultValue
	}
}

export async function getSystemConfigNumber(key: string, defaultValue: number): Promise<number> {
	const raw = await getSystemConfig(key, String(defaultValue))
	const n = Number(raw)
	return Number.isFinite(n) ? n : defaultValue
}

export function invalidateSystemConfigCache(key?: string): void {
	if (key == null) cache.clear()
	else cache.delete(key)
}
