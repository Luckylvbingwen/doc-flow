type LogoutBody = {
	token?: string
}

export default defineEventHandler(async (event) => {
	const _body = await readBody<LogoutBody>(event).catch(() => ({} as LogoutBody))

	return {
		success: true,
		code: 'OK',
		message: '退出登录成功'
	}
})
