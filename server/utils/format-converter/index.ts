import { NoopConverter } from './noop'
import type { FormatConverter } from './types'

/**
 * 单例导出
 *
 * B 阶段切换方式：
 *   import { ExternalConverter } from './external'
 *   export const converter: FormatConverter = new ExternalConverter({
 *     endpoint: process.env.FORMAT_CONVERTER_ENDPOINT!,
 *     token: process.env.FORMAT_CONVERTER_TOKEN,
 *   })
 */
export const converter: FormatConverter = new NoopConverter()
