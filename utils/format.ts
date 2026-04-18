/**
 * 时间格式化工具
 *
 * 后端统一返回毫秒时间戳，前端统一使用此函数格式化。
 *
 * @param value  时间戳(ms) / Date / ISO 字符串
 * @param format 格式模板，默认 'YYYY-MM-DD HH:mm:ss'
 *               支持: YYYY, MM, DD, HH, mm, ss
 */
export function formatTime(
	value: number | string | Date | null | undefined,
	format = 'YYYY-MM-DD HH:mm:ss',
): string {
	if (value == null || value === '') return '-'
	const d = new Date(value)
	if (isNaN(d.getTime())) return '-'

	const pad = (n: number) => String(n).padStart(2, '0')

	const tokens: Record<string, string> = {
		YYYY: String(d.getFullYear()),
		MM: pad(d.getMonth() + 1),
		DD: pad(d.getDate()),
		HH: pad(d.getHours()),
		mm: pad(d.getMinutes()),
		ss: pad(d.getSeconds()),
	}

	return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (m) => tokens[m])
}

/**
 * 文件大小格式化
 *
 * @param bytes 字节数
 * @param fractionDigits 小数位数，默认自适应（<10→1位，否则0位）
 */
export function formatBytes(bytes: number | null | undefined, fractionDigits?: number): string {
	if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '-'
	if (bytes === 0) return '0 B'
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
	const value = bytes / Math.pow(1024, exp)
	const digits = fractionDigits ?? (value < 10 ? 1 : 0)
	return `${value.toFixed(digits)} ${units[exp]}`
}
