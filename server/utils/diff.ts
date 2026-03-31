/**
 * 文本差异计算工具
 * 基于 diff 库实现行级 / 段落级 / 单词级 diff，
 * 并输出带 HTML 标记的对比内容
 */
import { diffLines, diffWords } from 'diff'
import type { DiffChunk, DiffSummary, DiffSummaryItem } from '~/types/version'

/** 对文本做行级 diff，返回结构化 DiffChunk 数组 */
export function computeLineDiff(oldText: string, newText: string): DiffChunk[] {
	const changes = diffLines(oldText, newText)
	const chunks: DiffChunk[] = []

	for (const change of changes) {
		if (change.added) {
			chunks.push({ type: 'add', newValue: change.value })
		} else if (change.removed) {
			chunks.push({ type: 'del', oldValue: change.value })
		} else {
			chunks.push({ type: 'equal', oldValue: change.value, newValue: change.value })
		}
	}

	return chunks
}

/** 将 DiffChunk 数组合并相邻的 add+del 为 modify */
export function mergeAdjacentDiffs(chunks: DiffChunk[]): DiffChunk[] {
	const merged: DiffChunk[] = []

	for (let i = 0; i < chunks.length; i++) {
		const curr = chunks[i]
		const next = chunks[i + 1]

		if (curr.type === 'del' && next?.type === 'add') {
			merged.push({
				type: 'modify',
				oldValue: curr.oldValue,
				newValue: next.newValue,
			})
			i++ // skip next
		} else {
			merged.push(curr)
		}
	}

	return merged
}

/** 从 DiffChunk 数组中生成变更摘要 */
export function buildDiffSummary(
	chunks: DiffChunk[],
	oldSize: number,
	newSize: number
): DiffSummary {
	let addCount = 0
	let delCount = 0
	let modCount = 0
	const items: DiffSummaryItem[] = []

	for (const chunk of chunks) {
		const lines = (chunk.newValue || chunk.oldValue || '').split('\n').filter(Boolean)
		switch (chunk.type) {
			case 'add':
				addCount += lines.length
				for (const line of lines.slice(0, 3)) {
					items.push({ type: 'add', text: truncate(line, 80) })
				}
				break
			case 'del':
				delCount += lines.length
				for (const line of lines.slice(0, 3)) {
					items.push({ type: 'del', text: truncate(line, 80) })
				}
				break
			case 'modify':
				modCount++
				items.push({ type: 'modify', text: truncate(chunk.newValue?.split('\n')[0] || '', 80) })
				break
		}
	}

	const sizeDiff = newSize - oldSize
	const sizeChange = sizeDiff >= 0
		? `+${formatBytes(sizeDiff)}`
		: `-${formatBytes(Math.abs(sizeDiff))}`

	return { addCount, delCount, modCount, sizeChange, items }
}

/**
 * 将 DiffChunk 数组渲染为两栏 HTML（新版 / 旧版各一份）
 * - 新版高亮 add（绿色）和 modify 中的新内容
 * - 旧版高亮 del（红色）和 modify 中的旧内容
 */
export function renderDiffHtml(
	chunks: DiffChunk[],
	docType: 'md' | 'docx' | 'pdf' | 'xlsx' | string
): { newHtml: string; oldHtml: string } {
	let newHtml = ''
	let oldHtml = ''
	const isMarkdown = docType === 'md' || docType === 'txt'

	for (const chunk of chunks) {
		switch (chunk.type) {
			case 'equal':
				newHtml += escapeHtml(chunk.newValue || '')
				oldHtml += escapeHtml(chunk.oldValue || '')
				break
			case 'add':
				newHtml += `<span class="diff-add">${escapeHtml(chunk.newValue || '')}</span>`
				break
			case 'del':
				oldHtml += `<span class="diff-del">${escapeHtml(chunk.oldValue || '')}</span>`
				break
			case 'modify': {
				const wordDiffs = diffWords(chunk.oldValue || '', chunk.newValue || '')
				let newPart = ''
				let oldPart = ''
				for (const w of wordDiffs) {
					if (w.added) {
						newPart += `<span class="diff-add">${escapeHtml(w.value)}</span>`
					} else if (w.removed) {
						oldPart += `<span class="diff-del">${escapeHtml(w.value)}</span>`
					} else {
						newPart += escapeHtml(w.value)
						oldPart += escapeHtml(w.value)
					}
				}
				newHtml += newPart
				oldHtml += oldPart
				break
			}
		}
	}

	// 按文档类型包装
	const wrapClass = isMarkdown ? 'diff-doc diff-doc--mono' : 'diff-doc'
	return {
		newHtml: `<div class="${wrapClass}">${newHtml}</div>`,
		oldHtml: `<div class="${wrapClass}">${oldHtml}</div>`,
	}
}

/** HTML 特殊字符转义 */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/\n/g, '<br>')
}

/** 截断字符串 */
function truncate(str: string, max: number): string {
	return str.length > max ? str.slice(0, max) + '…' : str
}

/** 格式化字节数 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B'
	const units = ['B', 'KB', 'MB', 'GB']
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
	const value = bytes / Math.pow(1024, i)
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}
