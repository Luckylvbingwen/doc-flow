/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @param successMsg 成功提示（默认"已复制"）
 *
 * msgSuccess / msgError 由 Nuxt 自动导入（composables/useNotify.ts 命名导出）
 */
export function useCopy(text: string, successMsg = '已复制') {
	return navigator.clipboard.writeText(text).then(
		() => msgSuccess(successMsg),
		() => msgError('复制失败，请手动复制'),
	)
}
