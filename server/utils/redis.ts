import Redis from 'ioredis'

let _redis: Redis | null = null

/**
 * 获取 Redis 单例客户端
 * 开发环境无 Redis 时降级为 null（限流等功能自动回退内存模式）
 */
export function getRedis(): Redis | null {
	if (_redis) return _redis

	const config = useRuntimeConfig()
	const url = config.redisUrl
	if (!url) return null

	try {
		_redis = new Redis(url, {
			maxRetriesPerRequest: 3,
			retryStrategy(times) {
				if (times > 5) return null // 超过 5 次停止重试
				return Math.min(times * 200, 2000)
			},
			lazyConnect: true,
		})

		_redis.on('error', (err) => {
			const logger = useLogger('redis')
			logger.error({ err }, 'Redis connection error')
		})

		_redis.connect().catch(() => {
			// lazyConnect 模式下 connect 失败不抛异常到全局
		})

		return _redis
	} catch {
		return null
	}
}
