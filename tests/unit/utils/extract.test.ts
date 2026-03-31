import { describe, it, expect, vi } from 'vitest'
import { extractText, isSupportedFormat } from '~/server/utils/extract'

describe('isSupportedFormat', () => {
	it('支持纯文本格式', () => {
		expect(isSupportedFormat('md')).toBe(true)
		expect(isSupportedFormat('txt')).toBe(true)
		expect(isSupportedFormat('markdown')).toBe(true)
		expect(isSupportedFormat('text')).toBe(true)
	})

	it('支持二进制文档格式', () => {
		expect(isSupportedFormat('docx')).toBe(true)
		expect(isSupportedFormat('pdf')).toBe(true)
		expect(isSupportedFormat('xlsx')).toBe(true)
		expect(isSupportedFormat('xls')).toBe(true)
	})

	it('大小写不敏感', () => {
		expect(isSupportedFormat('MD')).toBe(true)
		expect(isSupportedFormat('DOCX')).toBe(true)
		expect(isSupportedFormat('Pdf')).toBe(true)
	})

	it('去除前导点号', () => {
		expect(isSupportedFormat('.md')).toBe(true)
		expect(isSupportedFormat('.docx')).toBe(true)
	})

	it('拒绝不支持的格式', () => {
		expect(isSupportedFormat('jpg')).toBe(false)
		expect(isSupportedFormat('png')).toBe(false)
		expect(isSupportedFormat('mp4')).toBe(false)
		expect(isSupportedFormat('zip')).toBe(false)
		expect(isSupportedFormat('')).toBe(false)
	})
})

describe('extractText', () => {
	it('提取纯文本 (txt)', async () => {
		const buf = Buffer.from('Hello World\n第二行', 'utf-8')
		const result = await extractText(buf, 'txt')
		expect(result).toBe('Hello World\n第二行')
	})

	it('提取 Markdown (md)', async () => {
		const buf = Buffer.from('# 标题\n\n正文内容', 'utf-8')
		const result = await extractText(buf, 'md')
		expect(result).toBe('# 标题\n\n正文内容')
	})

	it('支持 .markdown 扩展名', async () => {
		const buf = Buffer.from('content', 'utf-8')
		const result = await extractText(buf, 'markdown')
		expect(result).toBe('content')
	})

	it('扩展名大小写不敏感', async () => {
		const buf = Buffer.from('test', 'utf-8')
		const result = await extractText(buf, 'TXT')
		expect(result).toBe('test')
	})

	it('去除扩展名前导点号', async () => {
		const buf = Buffer.from('dotted', 'utf-8')
		const result = await extractText(buf, '.txt')
		expect(result).toBe('dotted')
	})

	it('不支持的格式抛出错误', async () => {
		const buf = Buffer.from('data')
		await expect(extractText(buf, 'jpg')).rejects.toThrow('不支持的文件格式')
	})

	it('提取 docx 调用 mammoth', async () => {
		const mockResult = { value: '从 Word 提取的文本' }
		vi.doMock('mammoth', () => ({
			extractRawText: vi.fn().mockResolvedValue(mockResult),
		}))

		// 清除模块缓存以使用 mock
		const { extractText: extractMocked } = await import('~/server/utils/extract')
		const buf = Buffer.from('fake-docx')
		const result = await extractMocked(buf, 'docx')
		expect(result).toBe('从 Word 提取的文本')

		vi.doUnmock('mammoth')
	})

	it('提取 pdf 调用 pdf-parse', async () => {
		const mockResult = { text: 'PDF 文本内容' }
		vi.doMock('pdf-parse', () => ({
			default: vi.fn().mockResolvedValue(mockResult),
		}))

		const { extractText: extractMocked } = await import('~/server/utils/extract')
		const buf = Buffer.from('fake-pdf')
		const result = await extractMocked(buf, 'pdf')
		expect(result).toBe('PDF 文本内容')

		vi.doUnmock('pdf-parse')
	})

	it('提取 xlsx 调用 xlsx 库', async () => {
		vi.doMock('xlsx', () => ({
			read: vi.fn().mockReturnValue({
				SheetNames: ['Sheet1'],
				Sheets: { Sheet1: {} },
			}),
			utils: {
				sheet_to_json: vi.fn().mockReturnValue([
					['姓名', '年龄'],
					['张三', '25'],
				]),
			},
		}))

		const { extractText: extractMocked } = await import('~/server/utils/extract')
		const buf = Buffer.from('fake-xlsx')
		const result = await extractMocked(buf, 'xlsx')
		expect(result).toContain('[Sheet: Sheet1]')
		expect(result).toContain('姓名\t年龄')
		expect(result).toContain('张三\t25')

		vi.doUnmock('xlsx')
	})
})
