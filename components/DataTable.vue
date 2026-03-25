<template>
	<div class="df-data-table">
		<!-- ── Toolbar: 搜索 + 操作按钮 ── -->
		<div v-if="$slots.toolbar || showSearch" class="df-table-toolbar">
			<div class="df-table-toolbar-left">
				<el-input v-if="showSearch" v-model="searchKeyword" :placeholder="searchPlaceholder" clearable
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
			<el-table ref="tableRef" v-loading="loading" :data="data" :stripe="stripe" :border="border" :height="height"
				:max-height="maxHeight" :row-key="rowKey" :empty-text="emptyText" :default-sort="defaultSort"
				:row-class-name="rowClassName" :highlight-current-row="highlightCurrentRow"
				@selection-change="onSelectionChange" @sort-change="onSortChange" @row-click="onRowClick">
				<!-- 多选列 -->
				<el-table-column v-if="showSelection" type="selection" width="48" align="center"
					:reserve-selection="reserveSelection" />

				<!-- 序号列 -->
				<el-table-column v-if="showIndex" type="index" label="#" width="56" align="center" :index="indexMethod" />

				<!-- 动态列 -->
				<el-table-column v-for="col in columns" :key="col.prop || col.slot" :prop="col.prop" :label="col.label"
					:width="col.width" :min-width="col.minWidth" :sortable="col.sortable || false" :align="col.align || 'left'"
					:fixed="col.fixed" :show-overflow-tooltip="col.showOverflowTooltip !== false">
					<template #default="scope">
						<!-- 优先使用具名插槽 -->
						<slot v-if="col.slot" :name="col.slot" v-bind="scope" />
						<!-- 枚举标签渲染 -->
						<el-tag v-else-if="col.enum" :type="getEnumType(scope.row[col.prop], col.enum)" size="small"
							disable-transitions>
							{{ getEnumLabel(scope.row[col.prop], col.enum) }}
						</el-tag>
						<!-- 时间格式化 -->
						<span v-else-if="col.dateFormat">
							{{ formatDate(scope.row[col.prop], col.dateFormat) }}
						</span>
						<!-- 默认文本 -->
						<span v-else>{{ scope.row[col.prop] ?? '-' }}</span>
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
		<Pagination v-if="showPagination && total > 0" v-model:page="currentPage" v-model:pageSize="currentPageSize"
			:total="total" :page-sizes="pageSizes" :disabled="loading" @change="onPageChange" />
	</div>
</template>

<script setup>
import { Search } from '@element-plus/icons-vue'

const props = defineProps({
	// 数据
	data: { type: Array, default: () => [] },
	columns: { type: Array, required: true },
	loading: { type: Boolean, default: false },
	rowKey: { type: [String, Function], default: 'id' },
	emptyText: { type: String, default: '暂无数据' },

	// 外观
	stripe: { type: Boolean, default: true },
	border: { type: Boolean, default: false },
	height: { type: [String, Number], default: undefined },
	maxHeight: { type: [String, Number], default: undefined },
	highlightCurrentRow: { type: Boolean, default: false },
	rowClassName: { type: [String, Function], default: '' },

	// 功能开关
	showSelection: { type: Boolean, default: false },
	showIndex: { type: Boolean, default: false },
	reserveSelection: { type: Boolean, default: false },
	showSearch: { type: Boolean, default: false },
	searchPlaceholder: { type: String, default: '搜索关键词…' },

	// 排序
	defaultSort: { type: Object, default: () => ({}) },

	// 操作列
	actionWidth: { type: [String, Number], default: undefined },
	actionFixed: { type: [String, Boolean], default: 'right' },

	// 分页
	showPagination: { type: Boolean, default: true },
	page: { type: Number, default: 1 },
	pageSize: { type: Number, default: 10 },
	total: { type: Number, default: 0 },
	pageSizes: { type: Array, default: () => [10, 20, 50, 100] }
})

const emit = defineEmits([
	'update:page',
	'update:pageSize',
	'search',
	'selection-change',
	'sort-change',
	'row-click',
	'page-change'
])

const tableRef = ref(null)
const searchKeyword = ref('')

// ── 分页双向绑定 ──
const currentPage = computed({
	get: () => props.page,
	set: (val) => emit('update:page', val)
})

const currentPageSize = computed({
	get: () => props.pageSize,
	set: (val) => emit('update:pageSize', val)
})

// ── 序号（跨页连续） ──
const indexMethod = (index) => {
	return (props.page - 1) * props.pageSize + index + 1
}

// ── 事件 ──
const onSearch = () => {
	emit('update:page', 1)
	emit('search', searchKeyword.value)
}

const onSelectionChange = (selection) => {
	emit('selection-change', selection)
}

const onSortChange = ({ prop, order }) => {
	emit('sort-change', { prop, order })
}

const onRowClick = (row, column, event) => {
	emit('row-click', row, column, event)
}

const onPageChange = ({ page, pageSize }) => {
	emit('page-change', { page, pageSize })
}

// ── 枚举辅助 ──
const getEnumLabel = (value, enumMap) => {
	const item = enumMap.find((e) => e.value === value)
	return item?.label ?? value ?? '-'
}

const getEnumType = (value, enumMap) => {
	const item = enumMap.find((e) => e.value === value)
	return item?.type || 'info'
}

// ── 日期格式化 ──
const formatDate = (value, format) => {
	if (!value) return '-'
	const d = new Date(value)
	if (Number.isNaN(d.getTime())) return value
	if (format === 'date') return d.toLocaleDateString('zh-CN')
	if (format === 'datetime') return d.toLocaleString('zh-CN')
	return value
}

// ── 暴露 ref 供父组件调用 ──
defineExpose({
	/** 获取内部 el-table 实例 */
	getTableRef: () => tableRef.value,
	/** 清空选中 */
	clearSelection: () => tableRef.value?.clearSelection(),
	/** 切换行选中 */
	toggleRowSelection: (row, selected) => tableRef.value?.toggleRowSelection(row, selected)
})
</script>

<style scoped>
.df-data-table {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

/* ── 搜索工具栏（独立块） ── */
.df-table-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 16px;
	background: var(--df-panel);
	border: 1px solid var(--df-border);
	border-radius: 12px;
	box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.df-table-toolbar-left {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
}

.df-table-toolbar-right {
	display: flex;
	align-items: center;
	gap: 8px;
}

.df-table-search {
	width: 280px;
}

/* ── 表格区（独立块） ── */
.df-table-wrapper {
	background: var(--df-panel);
	border: 1px solid var(--df-border);
	border-radius: 12px;
	overflow: hidden;
	box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.df-data-table :deep(.el-table) {
	--el-table-border-color: var(--df-border);
	border-radius: 0;
}

.df-data-table :deep(.el-table::before),
.df-data-table :deep(.el-table::after) {
	display: none;
}

.df-data-table :deep(.el-table__inner-wrapper::before) {
	display: none;
}

.df-data-table :deep(.el-table th.el-table__cell) {
	background: var(--df-surface);
	font-size: 13px;
	font-weight: 600;
	color: var(--df-subtext);
}

.df-data-table :deep(.el-table__body tr:hover > td.el-table__cell) {
	background: var(--df-primary-soft);
}
</style>
