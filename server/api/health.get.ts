import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
	const checks: Record<string, { status: 'up' | 'down'; latencyMs?: number; error?: string }> = {}

	// DB check
	const dbStart = Date.now()
	try {
		await prisma.$queryRaw`SELECT 1`
		checks.database = { status: 'up', latencyMs: Date.now() - dbStart }
	} catch (err: unknown) {
		checks.database = { status: 'down', latencyMs: Date.now() - dbStart, error: (err as Error).message }
	}

	// Redis check
	const redisStart = Date.now()
	try {
		const redis = getRedis()
		if (redis) {
			await redis.ping()
			checks.redis = { status: 'up', latencyMs: Date.now() - redisStart }
		} else {
			checks.redis = { status: 'down', error: 'Redis not configured' }
		}
	} catch (err: unknown) {
		checks.redis = { status: 'down', latencyMs: Date.now() - redisStart, error: (err as Error).message }
	}

	const allUp = Object.values(checks).every((c) => c.status === 'up')

	return {
		ok: allUp,
		status: allUp ? 'healthy' : 'degraded',
		service: 'docflow-api',
		time: new Date().toISOString(),
		checks,
	}
})
