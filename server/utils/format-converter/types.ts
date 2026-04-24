/**
 * 格式转换接口
 *
 * A 阶段实现：NoopConverter（仅支持 .md，其他一律拒绝）
 * B 阶段实现：ExternalConverter（通过 HTTP 接口调用外部转换服务）
 */
export interface FormatConverter {
	/** 判断能否处理该扩展名（不含点号，小写） */
	canConvert(ext: string): boolean

	/**
	 * 把 buffer 转换为 Markdown 内容
	 *
	 * @throws 'FORMAT_CONVERTER_NOT_AVAILABLE' 当 canConvert 返回 false 时
	 * @throws 'FILE_CONVERT_FAILED' 当外部接口失败时（B 阶段）
	 */
	convert(input: {
		buffer: Buffer
		ext: string
		filename: string
	}): Promise<{
		content: string
		warnings?: string[]
	}>
}
