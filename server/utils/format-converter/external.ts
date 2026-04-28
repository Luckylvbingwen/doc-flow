import type { FormatConverter } from './types'

const CONVERTIBLE_EXTS = new Set(['docx', 'xlsx', 'pdf'])

/**
 * B 阶段实现：通过 HTTP POST 调用外部 office2md 服务
 */
export class ExternalConverter implements FormatConverter {
	private endpoint: string
	private token: string

	constructor(opts: { endpoint: string; token: string }) {
		this.endpoint = opts.endpoint.replace(/\/$/, '')
		this.token = opts.token
	}

	canConvert(ext: string): boolean {
		return CONVERTIBLE_EXTS.has(ext)
	}

	async convert(input: { buffer: Buffer; ext: string; filename: string }): Promise<{ content: string; warnings?: string[] }> {
		if (!this.canConvert(input.ext)) {
			throw new Error('FORMAT_CONVERTER_NOT_AVAILABLE')
		}

		const formData = new FormData()
		const blob = new Blob([new Uint8Array(input.buffer)])
		formData.append('file', blob, input.filename)
		formData.append('token', this.token)

		let res: Response
		try {
			res = await fetch(`${this.endpoint}/convert`, {
				method: 'POST',
				body: formData,
			})
		} catch (e) {
			console.error('[ExternalConverter] fetch failed', e)
			throw new Error('FILE_CONVERT_FAILED')
		}

		if (!res.ok) {
			const text = await res.text().catch(() => '')
			console.error(`[ExternalConverter] HTTP ${res.status}:`, text)
			throw new Error('FILE_CONVERT_FAILED')
		}

		const json = await res.json() as { output?: string; error?: string }
		if (json.error) {
			console.error('[ExternalConverter] service error:', json.error)
			throw new Error('FILE_CONVERT_FAILED')
		}

		if (!json.output) {
			throw new Error('FILE_CONVERT_FAILED')
		}

		// output 是一个下载 URL，需要获取其内容
		let mdContent: string
		try {
			const mdRes = await fetch(json.output)
			if (!mdRes.ok) throw new Error(`HTTP ${mdRes.status}`)
			mdContent = await mdRes.text()
		} catch (e) {
			console.error('[ExternalConverter] download md failed', e)
			throw new Error('FILE_CONVERT_FAILED')
		}

		return { content: mdContent }
	}
}
