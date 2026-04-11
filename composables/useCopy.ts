/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @param successMsg 成功提示（默认"已复制"）
 */
export function useCopy(text: string, successMsg = '已复制') {
	const { msgSuccess, msgError } = useNotify()

	return navigator.clipboard.writeText(text).then(
		() => msgSuccess(successMsg),
		() => msgError('复制失败，请手动复制'),
	)
}
