/**
 * 批量选择状态管理
 *
 * 用法：
 *   const { selected, selectedIds, onSelectionChange, clearSelection, hasSelection, count } = useBatchSelect<MyRow>()
 *   // 模板：<el-table @selection-change="onSelectionChange">
 */

export function useBatchSelect<T extends { id: number | bigint | string }>() {
	const selected = ref<T[]>([]) as Ref<T[]>

	const selectedIds = computed<number[]>(() =>
		selected.value.map(row => Number(row.id)),
	)

	const hasSelection = computed(() => selected.value.length > 0)
	const count = computed(() => selected.value.length)

	function onSelectionChange(rows: T[]) {
		selected.value = rows
	}

	function clearSelection() {
		selected.value = []
	}

	return { selected, selectedIds, onSelectionChange, clearSelection, hasSelection, count }
}
