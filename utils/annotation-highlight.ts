/**
 * 批注高亮工具
 *
 * 在已渲染的 HTML 容器中，根据批注列表的 quoteText 和 anchorData
 * 高亮标记对应文字，并返回清理函数。
 */
import type { AnnotationItem } from '~/types/document-editor'

const HIGHLIGHT_CLASS = 'annotation-highlight'
const HIGHLIGHT_ATTR = 'data-annotation-id'

/**
 * 应用批注高亮到容器 DOM
 * @returns 清理函数
 */
export function applyAnnotationHighlights(
	container: HTMLElement,
	annotations: AnnotationItem[],
	onClick?: (annotationId: string) => void,
): () => void {
	// 过滤有 quoteText 的批注
	const validAnnotations = annotations.filter(a => a.quoteText)
	if (!validAnnotations.length) return () => { }

	const marks: HTMLElement[] = []

	for (const ann of validAnnotations) {
		const found = findTextInDOM(container, ann.quoteText)
		if (!found) continue

		const { range } = found
		const mark = document.createElement('mark')
		mark.className = HIGHLIGHT_CLASS
		mark.setAttribute(HIGHLIGHT_ATTR, ann.id)
		if (ann.frozen) mark.classList.add('annotation-highlight--frozen')

		try {
			range.surroundContents(mark)
			marks.push(mark)

			if (onClick) {
				mark.addEventListener('click', (e) => {
					e.stopPropagation()
					onClick(ann.id)
				})
			}
		} catch {
			// surroundContents 在跨节点选区时会失败，跳过该批注
		}
	}

	// 返回清理函数
	return () => {
		for (const mark of marks) {
			const parent = mark.parentNode
			if (!parent) continue
			while (mark.firstChild) {
				parent.insertBefore(mark.firstChild, mark)
			}
			parent.removeChild(mark)
		}
		// 合并相邻文本节点
		container.normalize()
	}
}

/**
 * 在 DOM 中查找匹配 quoteText 的文本节点范围
 */
function findTextInDOM(container: HTMLElement, quoteText: string): { range: Range } | null {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
	let node: Node | null
	let accumulated = ''
	const nodes: { node: Text; start: number; end: number }[] = []

	while ((node = walker.nextNode())) {
		const text = node.textContent || ''
		const start = accumulated.length
		accumulated += text
		nodes.push({ node: node as Text, start, end: accumulated.length })

		// 检查累积文本中是否包含 quoteText
		const idx = accumulated.indexOf(quoteText)
		if (idx !== -1) {
			return createRangeFromPosition(nodes, idx, idx + quoteText.length)
		}
	}

	return null
}

function createRangeFromPosition(
	nodes: { node: Text; start: number; end: number }[],
	from: number,
	to: number,
): { range: Range } | null {
	let startNode: Text | null = null
	let startOffset = 0
	let endNode: Text | null = null
	let endOffset = 0

	for (const { node, start, end } of nodes) {
		if (!startNode && from >= start && from < end) {
			startNode = node
			startOffset = from - start
		}
		if (to > start && to <= end) {
			endNode = node
			endOffset = to - start
			break
		}
	}

	if (!startNode || !endNode) return null

	// 只支持同节点高亮（跨节点 surroundContents 会失败）
	if (startNode !== endNode) return null

	const range = document.createRange()
	range.setStart(startNode, startOffset)
	range.setEnd(endNode, endOffset)
	return { range }
}
