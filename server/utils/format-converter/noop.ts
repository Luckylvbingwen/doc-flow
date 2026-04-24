import type { FormatConverter } from './types'

/**
 * A 阶段占位实现：不支持任何转换
 *
 * 外层判断：ext === 'md' 时直接存；否则 canConvert() 返回 false，业务层抛 FILE_FORMAT_UNSUPPORTED
 */
export class NoopConverter implements FormatConverter {
	canConvert(_ext: string): boolean {
		return false
	}

	async convert(): Promise<never> {
		throw new Error('FORMAT_CONVERTER_NOT_AVAILABLE')
	}
}
