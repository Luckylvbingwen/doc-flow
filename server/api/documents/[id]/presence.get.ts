/**
 * GET /api/documents/:id/presence
 * 获取当前正在查看该文档的用户列表（60s 内有心跳的）
 */
export default defineEventHandler(async (event) => {
	const docId = getRouterParam(event, 'id')

	const redis = getRedis()
	if (!redis) return ok([])

	const key = `doc:presence:${docId}`
	const now = Date.now()
	// 清除过期
	await redis.zremrangebyscore(key, '-inf', (now - 60000).toString())
	// 获取当前成员
	const members = await redis.zrange(key, 0, -1)
	const users = members.map(m => {
		try { return JSON.parse(m) } catch { return null }
	}).filter(Boolean)

	return ok(users)
})
