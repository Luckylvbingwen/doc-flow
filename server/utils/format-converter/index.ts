import { NoopConverter } from './noop'
import { ExternalConverter } from './external'
import type { FormatConverter } from './types'

/**
 * 单例导出
 *
 * 当 FORMAT_CONVERTER_ENDPOINT + FORMAT_CONVERTER_TOKEN 环境变量已配置时，
 * 使用 ExternalConverter 对接外部 office2md 服务；否则回退 NoopConverter。
 */
const endpoint = process.env.FORMAT_CONVERTER_ENDPOINT
const token = process.env.FORMAT_CONVERTER_TOKEN

export const converter: FormatConverter = (endpoint && token)
	? new ExternalConverter({ endpoint, token })
	: new NoopConverter()
