/**
 * 从已渲染 HTML 中抽取 H1-H3 目录，并通过 IntersectionObserver 高亮当前可见标题。
 *
 * 复用场景：FullscreenPreviewer / 文件详情页常驻 TOC 侧栏
 */
import type { Ref } from 'vue'

export interface OutlineItem {
	id: string
	text: string
	level: 1 | 2 | 3
}

export function useOutline(
	/** el-scrollbar 实例 ref（需有 wrapRef 属性指向真实 DOM） */
	scrollerRef: Ref<{ wrapRef?: HTMLElement } | null>,
	/** 预览容器内 heading 的 CSS 选择器前缀 */
	selectorPrefix: string,
) {
	const outline = ref<OutlineItem[]>([])
	const activeOutlineId = ref<string | null>(null)

	let observer: IntersectionObserver | null = null

	function rebuildOutline() {
		outline.value = []
		activeOutlineId.value = null

		const container = scrollerRef.value?.wrapRef as HTMLElement | undefined
		if (!container) return

		const headings = Array.from(
			container.querySelectorAll(
				`${selectorPrefix} h1, ${selectorPrefix} h2, ${selectorPrefix} h3`,
			),
		)
		const items: OutlineItem[] = []

		headings.forEach((h, idx) => {
			const el = h as HTMLElement
			if (!el.id) el.id = `outline-h-${idx}`
			const level = (parseInt(el.tagName.slice(1)) as 1 | 2 | 3) || 1
			items.push({
				id: el.id,
				text: (el.textContent || '').trim() || `(无标题 #${idx + 1})`,
				level,
			})
		})
		outline.value = items
		if (items.length > 0) activeOutlineId.value = items[0].id

		setupObserver(headings as HTMLElement[])
	}

	function setupObserver(headings: HTMLElement[]) {
		teardownObserver()
		const container = scrollerRef.value?.wrapRef as HTMLElement | undefined
		if (!container || headings.length === 0) return

		observer = new IntersectionObserver(
			(entries) => {
				const visibleEntries = entries.filter(e => e.isIntersecting)
				if (visibleEntries.length === 0) return
				visibleEntries.sort(
					(a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
				)
				activeOutlineId.value = (visibleEntries[0].target as HTMLElement).id
			},
			{
				root: container,
				rootMargin: '-10% 0px -70% 0px',
				threshold: 0,
			},
		)
		headings.forEach(h => observer!.observe(h))
	}

	function teardownObserver() {
		observer?.disconnect()
		observer = null
	}

	function scrollToHeading(id: string) {
		const container = scrollerRef.value?.wrapRef as HTMLElement | undefined
		const target = container?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
		if (!target) return
		target.scrollIntoView({ behavior: 'smooth', block: 'start' })
		activeOutlineId.value = id
	}

	onBeforeUnmount(() => {
		teardownObserver()
	})

	return {
		outline,
		activeOutlineId,
		rebuildOutline,
		teardownObserver,
		scrollToHeading,
	}
}
