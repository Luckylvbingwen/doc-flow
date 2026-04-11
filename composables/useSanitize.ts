import DOMPurify from 'dompurify'

/**
 * 清洗 HTML 字符串，防止 XSS 注入
 * 用于所有 v-html 绑定场景
 */
export function sanitize(dirty: string | undefined | null): string {
	if (!dirty) return ''
	if (!import.meta.client) return dirty
	return DOMPurify.sanitize(dirty)
}
