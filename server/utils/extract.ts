/**
 * 文件内容提取工具
 * 从不同格式的文件 Buffer 中提取纯文本，供 diff 引擎使用
 *
 * 支持格式：
 * - Markdown / 纯文本：直接 toString
 * - Word (.docx)：通过 mammoth 提取
 * - PDF (.pdf)：通过 pdf-parse 提取
 * - Excel (.xlsx)：通过 xlsx 提取（按 sheet → 行 → 列 拼接）
 */

export type SupportedFormat = 'md' | 'txt' | 'docx' | 'pdf' | 'xlsx'

const TEXT_FORMATS = new Set<string>(['md', 'txt', 'markdown', 'text'])

/**
 * 从文件 Buffer 提取纯文本
 * @param buffer 文件二进制内容
 * @param ext    文件扩展名（不含点号）
 * @returns 提取的纯文本
 */
export async function extractText(buffer: Buffer, ext: string): Promise<string> {
	const format = ext.toLowerCase().replace(/^\./, '')

	if (TEXT_FORMATS.has(format)) {
		return buffer.toString('utf-8')
	}

	switch (format) {
		case 'docx':
			return extractDocx(buffer)
		case 'pdf':
			return extractPdf(buffer)
		case 'xlsx':
		case 'xls':
			return extractXlsx(buffer)
		default:
			throw new Error(`不支持的文件格式: ${ext}`)
	}
}

/** 从 Word 文档提取文本 */
async function extractDocx(buffer: Buffer): Promise<string> {
	const mammoth = await import('mammoth')
	const result = await mammoth.extractRawText({ buffer })
	return result.value
}

/** 从 PDF 文档提取文本 */
async function extractPdf(buffer: Buffer): Promise<string> {
	const pdfModule = await import('pdf-parse')
	const pdfParse = (pdfModule as any).default ?? pdfModule
	const result = await pdfParse(buffer)
	return result.text
}

/** 从 Excel 文件提取文本（sheet → 行 → 列 拼接） */
async function extractXlsx(buffer: Buffer): Promise<string> {
	const XLSX = await import('xlsx')
	const workbook = XLSX.read(buffer, { type: 'buffer' })
	const lines: string[] = []

	for (const sheetName of workbook.SheetNames) {
		lines.push(`[Sheet: ${sheetName}]`)
		const sheet = workbook.Sheets[sheetName]
		const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
		for (const row of rows) {
			lines.push((row as string[]).join('\t'))
		}
		lines.push('') // sheet 之间空行
	}

	return lines.join('\n')
}

/**
 * 判断文件扩展名是否受支持
 */
export function isSupportedFormat(ext: string): boolean {
	const format = ext.toLowerCase().replace(/^\./, '')
	return TEXT_FORMATS.has(format) || ['docx', 'pdf', 'xlsx', 'xls'].includes(format)
}
