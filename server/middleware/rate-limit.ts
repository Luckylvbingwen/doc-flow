/**
 * 服务端接口限流中间件
 * 基于 rate-limiter-flexible，支持 Redis（分布式）和 Memory（降级）双模式
 */
import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible'

// —— 限流策略配置 ——
const STRATEGIES = {
	/** 登录接口：5 次 / 5 分钟 / IP */
	login: { points: 5, duration: 300, keyPrefix: 'rl:login' },
	/** 认证类接口（captcha / feishu 等）：10 次 / 分钟 / IP */
	auth: { points: 10, duration: 60, keyPrefix: 'rl:auth' },
	/** 通用 API：100 次 / 分钟 / IP */
	api: { points: 100, duration: 60, keyPrefix: 'rl:api' },
} as const

type StrategyKey = keyof typeof STRATEGIES

/** 根据请求路径匹配限流策略 */
function resolveStrategy(path: string): StrategyKey {
	if (path === '/api/auth/login') return 'login'
	if (path.startsWith('/api/auth/')) return 'auth'
	return 'api'
}

// —— 限流器实例（惰性初始化）——
let limiters: Record<StrategyKey, RateLimiterAbstract> | null = null

function getLimiters(): Record<StrategyKey, RateLimiterAbstract> {
	if (limiters) return limiters

	const redis = getRedis()
	const logger = useLogger('rate-limit')

	const create = (cfg: (typeof STRATEGIES)[StrategyKey]): RateLimiterAbstract => {
		if (redis) {
			return new RateLimiterRedis({
				storeClient: redis,
				points: cfg.points,
				duration: cfg.duration,
				keyPrefix: cfg.keyPrefix,
			})
		}
		logger.warn('Redis unavailable, rate limiter falling back to memory mode')
		return new RateLimiterMemory({
			points: cfg.points,
			duration: cfg.duration,
			keyPrefix: cfg.keyPrefix,
		})
	}

	limiters = {
		login: create(STRATEGIES.login),
		auth: create(STRATEGIES.auth),
		api: create(STRATEGIES.api),
	}

	return limiters
}

export default defineEventHandler(async (event) => {
	const path = getRequestURL(event).pathname

	// 仅拦截 API 请求
	if (!path.startsWith('/api/')) return

	// 健康检查不限流
	if (path === '/api/health') return

	const strategy = resolveStrategy(path)
	const limiter = getLimiters()[strategy]
	const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

	try {
		const res = await limiter.consume(ip)

		// 注入限流响应头
		setResponseHeaders(event, {
			'X-RateLimit-Limit': String(STRATEGIES[strategy].points),
			'X-RateLimit-Remaining': String(res.remainingPoints),
			'X-RateLimit-Reset': String(Math.ceil(res.msBeforeNext / 1000)),
		})
	} catch (rlRes: unknown) {
		const info = rlRes as { msBeforeNext: number }
		const retrySec = Math.ceil(info.msBeforeNext / 1000)

		setResponseHeaders(event, {
			'Retry-After': String(retrySec),
			'X-RateLimit-Limit': String(STRATEGIES[strategy].points),
			'X-RateLimit-Remaining': '0',
			'X-RateLimit-Reset': String(retrySec),
		})

		setResponseStatus(event, 429)
		return {
			success: false,
			code: 'RATE_LIMITED',
			message: '请求过于频繁，请稍后再试',
		}
	}
})
