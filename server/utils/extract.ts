/**
 * 文件内容提取工具
 * 从不同格式的文件 Buffer 中提取纯文本，供 diff 引擎使用
 *
 * 支持格式：
 * - Markdown / 纯文本：直接 toString
 * - Word (.docx)：通过 mammoth 提取
 * - PDF (.pdf)：通过 pdf-parse 提取
 * - Excel (.xlsx)：通过 xlsx 提取（按 sheet → 行 → 列 拼接）
 *
 * 注意（Windows 开发环境 + 生产构建）：mammoth / pdf-parse / xlsx 一律通过 createRequire 加载。
 *   直接 `await import(...)` 会被 Nitro 的 Rollup CJS 插件内联这些 CJS 包，
 *   而 xlsx 内部 `require('./cpexcel.js')` 会被提升成顶层
 *   `import * as cpexcel from 'D:\\...\\cpexcel.js'` —— Windows Node ESM
 *   把 'D:' 当成协议抛 "Received protocol 'd:'"，所有请求 500。
 *   createRequire 让 Rollup 无法静态分析依赖，CJS 包保持运行时加载。
 *
 *   createRequire 的基准路径不能用 import.meta.url：Nitro 在生产构建会把
 *   `import.meta.url` 重写成占位的 `file:///_entry.js`，Node v24 严格校验下
 *   createRequire 会抛 ERR_INVALID_ARG_VALUE。这里改用 `process.cwd()/package.json`
 *   作为基准——一个一定存在的真实文件 URL，dev 与 prod 都适用。
 *   同时 nuxt.config.ts 的 nitro.externals.traceInclude 确保生产构建把这三个
 *   包复制进 .output/server/node_modules，Node 才能在运行时 require 到它们。
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import process from 'node:process'

const require = createRequire(pathToFileURL(join(process.cwd(), 'package.json')))

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
	const mammoth: typeof import('mammoth') = require('mammoth')
	const result = await mammoth.extractRawText({ buffer })
	return result.value
}

/** 从 PDF 文档提取文本（pdf-parse v2 API：实例化 PDFParse 后调 getText） */
async function extractPdf(buffer: Buffer): Promise<string> {
	const { PDFParse }: typeof import('pdf-parse') = require('pdf-parse')
	const parser = new PDFParse({ data: buffer })
	try {
		const result = await parser.getText()
		return result.text
	} finally {
		await parser.destroy()
	}
}

/** 从 Excel 文件提取文本（sheet → 行 → 列 拼接） */
async function extractXlsx(buffer: Buffer): Promise<string> {
	const XLSX: typeof import('xlsx') = require('xlsx')
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
