export default defineEventHandler(async (event) => {
	await readBody(event).catch(() => ({}))
	return ok(null, '退出登录成功')
})
