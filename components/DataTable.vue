<template>
	<div class="df-data-table">
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
		<div class="df-table-wrapper">
			<el-table
ref="tableRef" v-loading="loading" :data="data" :stripe="stripe" :border="border" :height="height"
				:max-height="maxHeight" :row-key="rowKey" :empty-text="emptyText" :default-sort="defaultSort"
				:row-class-name="rowClassName" :highlight-current-row="highlightCurrentRow"
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
						<slot name="action" v-bind="scope" />
					</template>
				</el-table-column>
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
	data?: Record<string, unknown>[]
	columns: TableColumn[]
	loading?: boolean
	rowKey?: string | ((row: Record<string, unknown>) => string)
	emptyText?: string
	stripe?: boolean
	border?: boolean
	height?: string | number
	maxHeight?: string | number
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
	stripe: false,
	border: false,
	height: undefined,
	maxHeight: undefined,
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
const searchKeyword = ref('')

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
