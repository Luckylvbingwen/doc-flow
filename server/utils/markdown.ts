/**
 * 服务端 Markdown 渲染管线（/api/documents/:id/preview 使用）
 *
 * 特意与 utils/markdown.ts（前端侧）分离：
 *   - 服务端 bundle 里不引入 DOMPurify / markdown-it-katex（依赖浏览器 / 老 CJS，会触发 Windows ESM 路径错）
 *   - 安全性：markdown-it html:false 已禁用原始 HTML 标签，输出到前端后再走 sanitize() 二次过滤
 */
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const md: MarkdownIt = new MarkdownIt({
	html:    false,
	linkify: true,
	breaks:  true,
	highlight(str: string, lang: string): string {
		if (lang && hljs.getLanguage(lang)) {
			try {
				return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
			} catch {
				/* fallthrough */
			}
		}
		return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
	},
})

/** 渲染 Markdown 为 HTML（服务端） */
export function renderMarkdown(content: string): string {
	return md.render(content)
}
