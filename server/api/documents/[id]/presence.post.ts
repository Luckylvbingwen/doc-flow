/**
 * POST /api/documents/:id/presence
 * 心跳注册当前用户正在查看该文档（Redis ZSET，score=时间戳，60s 过期）
 */
export default defineEventHandler(async (event) => {
	const docId = getRouterParam(event, 'id')
	const user = event.context.user

	const redis = getRedis()
	if (redis) {
		const key = `doc:presence:${docId}`
		const now = Date.now()
		// 添加/更新当前用户，score=当前时间戳
		await redis.zadd(key, now.toString(), JSON.stringify({ id: user.id, name: user.name }))
		// 清除 60s 前的过期成员
		await redis.zremrangebyscore(key, '-inf', (now - 60000).toString())
		// key 自动过期兜底
		await redis.expire(key, 120)
	}

	return ok(null)
})
