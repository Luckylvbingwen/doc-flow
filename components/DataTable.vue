<template>
	<div ref="rootRef" class="df-data-table" :class="{ 'is-fill-height': fillHeight }">
		<!-- ── Toolbar: 搜索 + 操作按钮 ── -->
		<div v-if="$slots.toolbar || showSearch" class="df-table-toolbar">
			<div class="df-table-toolbar-left">
				<el-input
v-if="showSearch" v-model="searchKeyword" :placeholder="searchPlaceholder" clearable
					class="df-table-search" @clear="onSearch" @keyup.enter="onSearch">
					<template #prefix>
						<el-icon>
							<Search />
						</el-icon>
					</template>
				</el-input>
			</div>
			<div class="df-table-toolbar-right">
				<slot name="toolbar" />
			</div>
		</div>

		<!-- ── Table ── -->
		<!-- fillHeight 模式：传 ResizeObserver 测得的像素 max-height 给 el-table，短内容自然渲染、长内容 el-table 自带的 el-scrollbar 滚动 + sticky 表头 -->
		<div class="df-table-wrapper">
			<el-table
ref="tableRef" v-loading="loading" :data="data" :stripe="stripe" :border="border" :height="height"
				:max-height="fillHeight ? (tableMaxHeight || undefined) : maxHeight" :row-key="rowKey" :empty-text="emptyText"
				:default-sort="defaultSort" :row-class-name="rowClassName" :highlight-current-row="highlightCurrentRow"
				@selection-change="onSelectionChange" @sort-change="onSortChange" @row-click="onRowClick">
				<!-- 多选列 -->
				<el-table-column
v-if="showSelection" type="selection" width="48" align="center"
					:reserve-selection="reserveSelection" />

				<!-- 序号列 -->
				<el-table-column v-if="showIndex" type="index" label="#" width="56" align="center" :index="indexMethod" />

				<!-- 动态列 -->
				<el-table-column
v-for="col in columns" :key="col.prop || col.slot" :prop="col.prop" :label="col.label"
					:width="col.width" :min-width="col.minWidth" :sortable="col.sortable || false" :align="col.align || 'left'"
					:fixed="col.fixed" :show-overflow-tooltip="col.showOverflowTooltip !== false">
					<template #default="scope">
						<!-- 优先使用具名插槽 -->
						<slot v-if="col.slot" :name="col.slot" v-bind="scope" />
						<!-- 枚举标签渲染 -->
						<el-tag
v-else-if="col.enum" :type="getEnumType(getCellValue(scope.row, col.prop), col.enum)" size="small"
							disable-transitions>
							{{ getEnumLabel(getCellValue(scope.row, col.prop), col.enum) }}
						</el-tag>
						<!-- 时间格式化 -->
						<span v-else-if="col.dateFormat">
							{{ formatDate(getCellValue(scope.row, col.prop), col.dateFormat) }}
						</span>
						<!-- 默认文本 -->
						<span v-else>{{ getCellValue(scope.row, col.prop) ?? '-' }}</span>
					</template>
				</el-table-column>

				<!-- 操作列 -->
				<el-table-column v-if="$slots.action" label="操作" :width="actionWidth" :fixed="actionFixed" align="center">
					<template #default="scope">
						<div class="df-action-cell">
							<slot name="action" v-bind="scope" />
						</div>
					</template>
				</el-table-column>

				<!-- 空状态 -->
				<template v-if="emptyPreset" #empty>
					<EmptyState :preset="emptyPreset" compact />
				</template>
			</el-table>
		</div>

		<!-- ── 分页（独立块） ── -->
		<Pagination
v-if="showPagination && total > 0" v-model:page="currentPage" v-model:page-size="currentPageSize"
			:total="total" :page-sizes="pageSizes" :disabled="loading" :table-ref="tableRef" @change="onPageChange" />
	</div>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { formatTime } from '~/utils/format'
import type { TableInstance } from 'element-plus'

/** 枚举项定义 */
export interface EnumItem {
	value: string | number | boolean
	label: string
	type?: '' | 'success' | 'warning' | 'info' | 'danger'
}

/** 列定义 */
export interface TableColumn {
	prop?: string
	label?: string
	slot?: string
	width?: string | number
	minWidth?: string | number
	sortable?: boolean | 'custom'
	align?: string
	fixed?: string | boolean
	showOverflowTooltip?: boolean
	enum?: EnumItem[]
	dateFormat?: 'date' | 'datetime' | string
}

interface DataTableProps {
	// 放宽为 Record<string, any>[]：允许具体业务类型（LogItem / RecycleItem 等）直接传入，
	// 避免每个页面都要 `as unknown as Record<string, unknown>[]` 强转；行渲染通过插槽与 TableColumn.prop，
	// 此处严格类型没有实际价值
	data?: Record<string, any>[]
	columns: TableColumn[]
	loading?: boolean
	rowKey?: string | ((row: Record<string, any>) => string)
	emptyText?: string
	emptyPreset?: string
	stripe?: boolean
	border?: boolean
	height?: string | number
	maxHeight?: string | number
	/** 填充父容器高度：表格内部滚动，表头 + 分页常驻；与 ListPageShell 配套使用 */
	fillHeight?: boolean
	highlightCurrentRow?: boolean
	rowClassName?: string | ((data: { row: Record<string, unknown>; rowIndex: number }) => string)
	showSelection?: boolean
	showIndex?: boolean
	reserveSelection?: boolean
	showSearch?: boolean
	searchPlaceholder?: string
	defaultSort?: { prop: string; order: 'ascending' | 'descending' }
	actionWidth?: string | number
	actionFixed?: 'left' | 'right' | boolean
	showPagination?: boolean
	page?: number
	pageSize?: number
	total?: number
	pageSizes?: number[]
}

const props = withDefaults(defineProps<DataTableProps>(), {
	data: () => [],
	loading: false,
	rowKey: 'id',
	emptyText: '暂无数据',
	emptyPreset: undefined,
	stripe: false,
	border: true,
	height: undefined,
	maxHeight: undefined,
	fillHeight: false,
	highlightCurrentRow: false,
	rowClassName: '',
	showSelection: false,
	showIndex: false,
	reserveSelection: false,
	showSearch: false,
	searchPlaceholder: '搜索关键词…',
	defaultSort: undefined,
	actionWidth: undefined,
	actionFixed: 'right',
	showPagination: true,
	page: 1,
	pageSize: 10,
	total: 0,
	pageSizes: () => [10, 20, 50, 100],
})

const emit = defineEmits<{
	'update:page': [value: number]
	'update:pageSize': [value: number]
	'search': [keyword: string]
	'selection-change': [selection: Record<string, unknown>[]]
	'sort-change': [payload: { prop: string; order: string | null }]
	'row-click': [row: Record<string, unknown>, column: unknown, event: Event]
	'page-change': [payload: { page: number; pageSize: number }]
}>()

const tableRef = ref<TableInstance>()
const rootRef = ref<HTMLElement>()
const searchKeyword = ref('')

// ── fillHeight 模式：测量父容器可给表格的像素高度，传给 el-table 的 max-height ──
// 逻辑：max = parent.clientHeight - (同级 toolbar + 同级 pagination + gap)
// 效果：数据少时 table 自然高度、分页紧跟；数据多时 table 内部 el-scrollbar 滚动 + sticky 表头 + 漂亮无箭头滚动条
const tableMaxHeight = ref<number>()
let resizeObserver: ResizeObserver | null = null

const GAP_PX = 12 // 与 .df-data-table { gap: 12px } 保持一致

function updateTableMaxHeight() {
	const root = rootRef.value
	if (!root) return
	const parent = root.parentElement
	if (!parent) return
	const parentH = parent.clientHeight
	if (!parentH) return

	const children = Array.from(root.children) as HTMLElement[]
	let consumed = 0
	let visibleCount = 0
	for (const c of children) {
		if (c.offsetHeight === 0) continue
		visibleCount++
		if (c.classList.contains('df-table-wrapper')) continue
		consumed += c.offsetHeight
	}
	const gaps = Math.max(0, visibleCount - 1) * GAP_PX
	tableMaxHeight.value = Math.max(0, parentH - consumed - gaps)
}

onMounted(async () => {
	if (!props.fillHeight) return
	await nextTick()
	updateTableMaxHeight()
	const root = rootRef.value
	const parent = root?.parentElement
	if (!root || !parent) return
	resizeObserver = new ResizeObserver(() => updateTableMaxHeight())
	resizeObserver.observe(parent)
	resizeObserver.observe(root)
})

onBeforeUnmount(() => {
	resizeObserver?.disconnect()
	resizeObserver = null
})

// ── 分页双向绑定 ──
const currentPage = computed({
	get: () => props.page,
	set: (val: number) => emit('update:page', val)
})

const currentPageSize = computed({
	get: () => props.pageSize,
	set: (val: number) => emit('update:pageSize', val)
})

// ── 序号（跨页连续） ──
const indexMethod = (index: number) => {
	return (props.page - 1) * props.pageSize + index + 1
}

// ── 事件 ──
const onSearch = () => {
	emit('update:page', 1)
	emit('search', searchKeyword.value)
}

const onSelectionChange = (selection: Record<string, unknown>[]) => {
	emit('selection-change', selection)
}

const onSortChange = ({ prop, order }: { prop: string; order: string | null }) => {
	emit('sort-change', { prop, order })
}

const onRowClick = (row: Record<string, unknown>, column: unknown, event: Event) => {
	emit('row-click', row, column, event)
}

const onPageChange = ({ page, pageSize }: { page: number; pageSize: number }) => {
	emit('page-change', { page, pageSize })
}

// ── 单元格取值 ──
const getCellValue = (row: Record<string, unknown>, prop?: string): unknown => {
	return prop ? row[prop] : undefined
}

// ── 枚举辅助 ──
const getEnumLabel = (value: unknown, enumMap: EnumItem[]) => {
	const item = enumMap.find((e) => e.value === value)
	return item?.label ?? value ?? '-'
}

const getEnumType = (value: unknown, enumMap: EnumItem[]) => {
	const item = enumMap.find((e) => e.value === value)
	return item?.type || 'info'
}

// ── 日期格式化 ──
const formatDate = (value: unknown, format: string) => {
	if (format === 'date') return formatTime(value as number, 'YYYY-MM-DD')
	if (format === 'datetime') return formatTime(value as number, 'YYYY-MM-DD HH:mm:ss')
	return formatTime(value as number, format)
}

// ── 暴露 ref 供父组件调用 ──
defineExpose({
	getTableRef: () => tableRef.value,
	clearSelection: () => tableRef.value?.clearSelection(),
	toggleRowSelection: (row: Record<string, unknown>, selected?: boolean) => tableRef.value?.toggleRowSelection(row, selected)
})
</script>
