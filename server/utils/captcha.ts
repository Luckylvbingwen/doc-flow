/**
 * 无状态「点选文字」验证码
 * - 在 SVG 画布上绘制背景 + 干扰 + 目标文字
 * - 使用 HMAC-SHA256 把答案坐标签入 token，不需要数据库
 * - 前端点击后提交坐标，后端重算签名校验
 */
import { createHmac, randomInt } from 'node:crypto'

/** 验证码有效期（秒） */
const CAPTCHA_TTL = 300
/** 点击容差（px），在此范围内视为命中 */
const HIT_TOLERANCE = 30
/** 画布尺寸 */
const WIDTH = 320
const HEIGHT = 180
/** 目标字数 */
const TARGET_COUNT = 3
/** 干扰字数 */
const NOISE_COUNT = 4

/** 常用中文字符池 */
const CHAR_POOL = '天地人和风云山水日月星辰花雪雨虹春夏秋冬龙虎鹤鹿梅兰竹菊江河湖海金木石玉飞舞光影'

function getSecret(): string {
	const config = useRuntimeConfig()
	return config.jwtSecret || 'docflow-captcha-fallback-key'
}

function hmacSign(data: string, timestamp: number): string {
	const secret = getSecret()
	return createHmac('sha256', secret)
		.update(`${data}:${timestamp}`)
		.digest('hex')
}

/** 从字符池随机取 n 个不重复字符 */
function pickChars(n: number): string[] {
	const pool = [...CHAR_POOL]
	const result: string[] = []
	for (let i = 0; i < n && pool.length > 0; i++) {
		const idx = randomInt(pool.length)
		result.push(pool[idx])
		pool.splice(idx, 1)
	}
	return result
}

/** 随机颜色 */
function randColor(min = 40, max = 160): string {
	const r = randomInt(min, max)
	const g = randomInt(min, max)
	const b = randomInt(min, max)
	return `rgb(${r},${g},${b})`
}

interface CharPos {
	char: string
	x: number
	y: number
}

/** 检查两点是否重叠（距离过近） */
function overlaps(a: { x: number; y: number }, b: { x: number; y: number }, minDist: number): boolean {
	return Math.abs(a.x - b.x) < minDist && Math.abs(a.y - b.y) < minDist
}

/** 在画布内随机放置一个字符位置，避免与已有位置重叠 */
function placeChar(existing: CharPos[], char: string): CharPos {
	const margin = 30
	for (let attempt = 0; attempt < 50; attempt++) {
		const x = randomInt(margin, WIDTH - margin)
		const y = randomInt(margin + 10, HEIGHT - margin)
		if (!existing.some(p => overlaps(p, { x, y }, 45))) {
			return { char, x, y }
		}
	}
	// 如果 50 次未找到非重叠位置，强制放置
	return { char, x: randomInt(margin, WIDTH - margin), y: randomInt(margin + 10, HEIGHT - margin) }
}

/** 生成 SVG 背景与干扰元素 */
function buildSvg(allChars: CharPos[]): string {
	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`

	// 背景渐变
	const bg1 = randColor(200, 240)
	const bg2 = randColor(200, 240)
	svg += `<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs>`
	svg += `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" rx="8"/>`

	// 干扰线
	for (let i = 0; i < 6; i++) {
		const x1 = randomInt(0, WIDTH)
		const y1 = randomInt(0, HEIGHT)
		const x2 = randomInt(0, WIDTH)
		const y2 = randomInt(0, HEIGHT)
		svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${randColor(180, 220)}" stroke-width="${randomInt(1, 3)}" opacity="0.5"/>`
	}

	// 干扰圆点
	for (let i = 0; i < 15; i++) {
		svg += `<circle cx="${randomInt(0, WIDTH)}" cy="${randomInt(0, HEIGHT)}" r="${randomInt(2, 6)}" fill="${randColor(180, 220)}" opacity="0.4"/>`
	}

	// 放置文字
	for (const c of allChars) {
		const fontSize = randomInt(26, 34)
		const rotate = randomInt(-25, 25)
		svg += `<text x="${c.x}" y="${c.y}" font-size="${fontSize}" font-weight="bold" fill="${randColor()}" text-anchor="middle" dominant-baseline="central" transform="rotate(${rotate},${c.x},${c.y})">${c.char}</text>`
	}

	svg += `</svg>`
	return svg
}

export interface CaptchaResult {
	svg: string
	token: string
	prompt: string
	width: number
	height: number
}

/** 生成点选验证码 */
export function generateCaptcha(): CaptchaResult {
	const targets = pickChars(TARGET_COUNT)
	const noiseChars = pickChars(NOISE_COUNT).filter(c => !targets.includes(c))

	const allPositions: CharPos[] = []

	// 放置目标文字
	const targetPositions: CharPos[] = []
	for (const ch of targets) {
		const pos = placeChar(allPositions, ch)
		targetPositions.push(pos)
		allPositions.push(pos)
	}

	// 放置干扰文字
	for (const ch of noiseChars) {
		allPositions.push(placeChar(allPositions, ch))
	}

	// 打乱所有文字的渲染顺序，让目标字符不按顺序出现
	const shuffled = [...allPositions].sort(() => Math.random() - 0.5)
	const svg = buildSvg(shuffled)

	// 签名：将目标坐标编码后 HMAC 签名
	const timestamp = Math.floor(Date.now() / 1000)
	const answerData = targetPositions.map(p => `${p.x},${p.y}`).join('|')
	const signature = hmacSign(answerData, timestamp)
	const token = `${timestamp}.${answerData}.${signature}`

	const prompt = `请依次点击：${targets.join('、')}`

	return { svg, token, prompt, width: WIDTH, height: HEIGHT }
}

export interface ClickPoint {
	x: number
	y: number
}

/** 校验点选验证码 */
export function verifyCaptcha(clicks: ClickPoint[], token: string): { valid: boolean; message: string } {
	if (!clicks || !token) {
		return { valid: false, message: '请完成验证码' }
	}

	const parts = token.split('.')
	if (parts.length !== 3) {
		return { valid: false, message: '验证码令牌格式错误' }
	}

	const timestamp = parseInt(parts[0], 10)
	const answerData = parts[1]
	const signature = parts[2]

	if (isNaN(timestamp)) {
		return { valid: false, message: '验证码令牌格式错误' }
	}

	// 检查过期
	const now = Math.floor(Date.now() / 1000)
	if (now - timestamp > CAPTCHA_TTL) {
		return { valid: false, message: '验证码已过期，请刷新重试' }
	}

	// 验签
	const expected = hmacSign(answerData, timestamp)
	if (expected !== signature) {
		return { valid: false, message: '验证码令牌被篡改' }
	}

	// 解析目标坐标
	const targetCoords = answerData.split('|').map(s => {
		const [x, y] = s.split(',').map(Number)
		return { x, y }
	})

	if (clicks.length !== targetCoords.length) {
		return { valid: false, message: '验证码点击次数不正确' }
	}

	// 逐个检查点击是否命中目标
	for (let i = 0; i < targetCoords.length; i++) {
		const dx = Math.abs(clicks[i].x - targetCoords[i].x)
		const dy = Math.abs(clicks[i].y - targetCoords[i].y)
		if (dx > HIT_TOLERANCE || dy > HIT_TOLERANCE) {
			return { valid: false, message: '验证码校验失败，请重试' }
		}
	}

	return { valid: true, message: '' }
}
