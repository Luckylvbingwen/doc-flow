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
