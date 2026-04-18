<template>
	<ListPageShell>
		<template #header>
			<PageTitle title="回收站" subtitle="已删除的文件在此保留 30 天" :refreshing="loading" @refresh="fetchList" />
		</template>

		<template #filter>
			<FilterBar :clear-count="activeFilterCount" @clear="onResetFilter">
				<div class="df-filter-item">
					<label class="df-filter-label">关键词</label>
					<el-input
v-model="filterKeyword" placeholder="搜索文件名..." clearable @keyup.enter="onFilterChange"
						@clear="onFilterChange">
						<template #prefix>
							<el-icon>
								<Search />
							</el-icon>
						</template>
					</el-input>
				</div>
				<div class="df-filter-item">
					<label class="df-filter-label">原仓库</label>
					<RemoteSelect
v-model="filterGroupId" :fetch-fn="fetchFilterGroups" placeholder="全部仓库" item-label="name"
						item-value="id" @change="onFilterChange" />
				</div>
			</FilterBar>
		</template>

		<DataTable
ref="tableRef" v-model:page="currentPage" v-model:page-size="currentPageSize" :data="list"
			:columns="columns" :total="total" :loading="loading" :page-sizes="[10, 15, 30, 50]" empty-preset="no-trash"
			row-key="id" show-selection fill-height :action-width="200" @page-change="onPageChange"
			@selection-change="onSelectionChange">
			<template #title="{ row }">
				<div class="recycle-title">
					<div class="recycle-file-icon" :class="getFileTypeClass(row.ext)">
						{{ getFileTypeLabel(row.ext) }}
					</div>
					<div class="recycle-title-text">
						<span class="recycle-title-name" :title="row.title">{{ row.title }}</span>
						<span class="recycle-title-meta">v{{ row.versionCount }} · {{ formatBytes(row.fileSize) }}</span>
					</div>
				</div>
			</template>
			<template #deletedAt="{ row }">
				<span class="recycle-time">{{ formatTime(row.deletedAt, 'YYYY-MM-DD HH:mm:ss') }}</span>
			</template>
			<template #versionCount="{ row }">
				<span class="recycle-version">v{{ row.versionCount }}</span>
			</template>
			<template #fileSize="{ row }">
				<span class="recycle-size">{{ formatBytes(row.fileSize) }}</span>
			</template>
			<template #action="{ row }">
				<el-button
v-if="canRestore" type="primary" text size="small" :loading="restoringId === row.id"
					:disabled="busy && restoringId !== row.id" @click="onRestore(row)">
					恢复
				</el-button>
				<el-button
v-if="canPurge" type="danger" text size="small" :loading="purgingId === row.id"
					:disabled="busy && purgingId !== row.id" @click="onPurge(row)">
					永久删除
				</el-button>
			</template>
		</DataTable>

		<BulkActionBar :count="selection.length" @clear="clearSelection">
			<el-button v-if="canRestore" type="primary" :loading="bulkRestoring" @click="onBulkRestore">批量恢复</el-button>
			<el-button v-if="canPurge" type="danger" :loading="bulkPurging" @click="onBulkPurge">批量永久删除</el-button>
		</BulkActionBar>
	</ListPageShell>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import type { TableColumn } from '~/components/DataTable.vue'
import { formatTime, formatBytes } from '~/utils/format'
import {
	apiGetRecycleList,
	apiGetRecycleFilterGroups,
	apiRestoreRecycle,
	apiPurgeRecycle,
	type RecycleListQuery,
} from '~/api/recycle-bin'
import type {
	RecycleItem,
	RecycleFilterGroup,
	RecycleBatchFailedItem,
	RecycleRestoreResult,
	RecyclePurgeResult,
} from '~/types/recycle-bin'
import type { ApiResult } from '~/types/api'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
	middleware: defineNuxtRouteMiddleware(() => {
		const { can } = useAuth()
		if (!can('recycle:read')) {
			return navigateTo('/docs')
		}
	}),
})
useHead({ title: '回收站 - DocFlow' })

const { can } = useAuth()
const canRestore = computed(() => can('recycle:restore'))
const canPurge = computed(() => can('recycle:delete'))

// ── 筛选 ──
const filterKeyword = ref('')
const filterGroupId = ref<number | null>(null)

const activeFilterCount = computed(() => {
	let n = 0
	if (filterKeyword.value) n++
	if (filterGroupId.value != null) n++
	return n
})

// ── 选择 ──
const tableRef = ref<{ clearSelection: () => void } | null>(null)
const selection = ref<RecycleItem[]>([])
function onSelectionChange(rows: Record<string, unknown>[]) {
	selection.value = rows as unknown as RecycleItem[]
}
function clearSelection() {
	tableRef.value?.clearSelection()
	selection.value = []
}

// ── 行级 loading 追踪 ──
const restoringId = ref<number | null>(null)
const purgingId = ref<number | null>(null)
const bulkRestoring = ref(false)
const bulkPurging = ref(false)
const busy = computed(() => restoringId.value != null || purgingId.value != null || bulkRestoring.value || bulkPurging.value)

const columns: TableColumn[] = [
	{ label: '文件名', slot: 'title', minWidth: 260 },
	{ prop: 'groupName', label: '原仓库', width: 160 },
	{ prop: 'deletedByName', label: '删除人', width: 120 },
	{ label: '删除时间', slot: 'deletedAt', width: 180 },
	{ label: '大小', slot: 'fileSize', width: 100, align: 'right' },
	{ label: '版本数', slot: 'versionCount', width: 90, align: 'center' },
]

// ── 文件类型图标 ──
function getFileTypeClass(ext: string): string {
	const e = (ext || '').toLowerCase()
	if (e === 'pdf') return 'is-pdf'
	if (e === 'doc' || e === 'docx') return 'is-word'
	if (e === 'xls' || e === 'xlsx') return 'is-excel'
	if (e === 'md') return 'is-md'
	return 'is-other'
}
function getFileTypeLabel(ext: string): string {
	const e = (ext || '').toUpperCase()
	return e || 'FILE'
}

// ── 加载 ──
const {
	page: currentPage,
	pageSize: currentPageSize,
	list,
	total,
	loading,
	refresh: fetchList,
	onFilterChange,
	onResetFilter,
	onPageChange,
} = useListPage<RecycleItem, RecycleListQuery>({
	fetchFn: apiGetRecycleList,
	buildQuery: ({ page, pageSize }) => ({
		keyword: filterKeyword.value || undefined,
		groupId: filterGroupId.value ?? undefined,
		page,
		pageSize,
	}),
	resetFilters: () => {
		filterKeyword.value = ''
		filterGroupId.value = null
	},
})

// RemoteSelect 的 fetch 适配
async function fetchFilterGroups(params: { keyword: string; page: number; pageSize: number }) {
	const res = await apiGetRecycleFilterGroups({
		keyword: params.keyword || undefined,
		page: params.page,
		pageSize: params.pageSize,
	})
	if (res.success) return { list: res.data.list as RecycleFilterGroup[], total: res.data.total }
	return { list: [], total: 0 }
}

// ── 行操作 ──
async function onRestore(row: RecycleItem) {
	const ok = await msgConfirm(`确定将「${row.title}」恢复到原仓库「${row.groupName}」？`)
	if (!ok) return
	restoringId.value = row.id
	try {
		const res = await apiRestoreRecycle([row.id])
		reportBatchResult(res, '恢复')
	} catch {
		msgError('恢复失败')
	} finally {
		restoringId.value = null
	}
}

async function onPurge(row: RecycleItem) {
	const ok = await msgConfirm(
		`永久删除后不可恢复。确定永久删除「${row.title}」？`,
		'永久删除确认',
		{ type: 'error', danger: true, confirmText: '永久删除' },
	)
	if (!ok) return
	purgingId.value = row.id
	try {
		const res = await apiPurgeRecycle([row.id])
		reportBatchResult(res, '永久删除')
	} catch {
		msgError('永久删除失败')
	} finally {
		purgingId.value = null
	}
}

// ── 批量操作 ──
async function onBulkRestore() {
	const ids = selection.value.map(r => r.id)
	if (ids.length === 0) return
	const ok = await msgConfirm(`确定恢复已选 ${ids.length} 个文件到其原仓库？`)
	if (!ok) return
	bulkRestoring.value = true
	try {
		const res = await apiRestoreRecycle(ids)
		reportBatchResult(res, '恢复')
	} catch {
		msgError('批量恢复失败')
	} finally {
		bulkRestoring.value = false
	}
}

async function onBulkPurge() {
	const ids = selection.value.map(r => r.id)
	if (ids.length === 0) return
	const ok = await msgConfirm(
		`永久删除 ${ids.length} 个文件后不可恢复。确认继续？`,
		'永久删除确认',
		{ type: 'error', danger: true, confirmText: '永久删除' },
	)
	if (!ok) return
	bulkPurging.value = true
	try {
		const res = await apiPurgeRecycle(ids)
		reportBatchResult(res, '永久删除')
	} catch {
		msgError('批量永久删除失败')
	} finally {
		bulkPurging.value = false
	}
}

// ── 统一提示 + 刷新 ──
type BatchRes = ApiResult<RecycleRestoreResult | RecyclePurgeResult>
function reportBatchResult(res: BatchRes, verb: string) {
	if (!res.success) {
		msgError(res.message || `${verb}失败`)
		return
	}
	const data = res.data as { restoredCount?: number; purgedCount?: number; failed: RecycleBatchFailedItem[] }
	const count = data.restoredCount ?? data.purgedCount ?? 0
	if (data.failed.length === 0) {
		msgSuccess(res.message || `${verb}成功`)
	} else {
		const detail = data.failed.slice(0, 3).map(f => `${f.title || `#${f.id}`}: ${f.reason}`).join('；')
		const more = data.failed.length > 3 ? `，等 ${data.failed.length} 项失败` : ''
		msgErrorDetail(`${verb}成功 ${count} 项${more}`, detail)
	}
	clearSelection()
	fetchList()
}
</script>

<style lang="scss" scoped>
.recycle-title {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.recycle-file-icon {
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	border-radius: 6px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 10px;
	font-weight: 600;
	color: #fff;
	background: #94a3b8;

	&.is-pdf {
		background: #ef4444;
	}

	&.is-word {
		background: #2563eb;
	}

	&.is-excel {
		background: #10b981;
	}

	&.is-md {
		background: #8b5cf6;
	}
}

.recycle-title-text {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.recycle-title-name {
	color: var(--df-text);
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.recycle-title-meta {
	font-size: 12px;
	color: var(--df-subtext);
}

.recycle-time,
.recycle-size,
.recycle-version {
	color: var(--df-subtext);
	font-size: 13px;
	font-variant-numeric: tabular-nums;
}
</style>
