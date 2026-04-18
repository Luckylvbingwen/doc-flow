/**
 * 文件类型图标工具（按扩展名 → CSS class + 显示文案）
 *
 * 用于列表/卡片左侧的彩色文件类型图标块，例如：
 *   <div class="file-icon" :class="getFileTypeClass(ext)">{{ getFileTypeLabel(ext) }}</div>
 */

/** 扩展名 → CSS 后缀 class（默认 is-other） */
export function getFileTypeClass(ext: string | null | undefined): string {
	const e = (ext || '').toLowerCase()
	if (e === 'pdf') return 'is-pdf'
	if (e === 'doc' || e === 'docx') return 'is-word'
	if (e === 'xls' || e === 'xlsx') return 'is-excel'
	if (e === 'md') return 'is-md'
	return 'is-other'
}

/** 扩展名 → 显示文案（大写；空值显示 'FILE'） */
export function getFileTypeLabel(ext: string | null | undefined): string {
	return ((ext || 'FILE') + '').toUpperCase()
}
