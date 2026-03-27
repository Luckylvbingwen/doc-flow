import { generateCaptcha } from '../../utils/captcha'

export default defineEventHandler(() => {
	const captcha = generateCaptcha()

	return ok({
		svg: captcha.svg,
		token: captcha.token,
		prompt: captcha.prompt,
		width: captcha.width,
		height: captcha.height,
	})
})
