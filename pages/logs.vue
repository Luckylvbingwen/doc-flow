<template>
	<ListPageShell>
		<template #header>
			<PageTitle title="操作日志" :refreshing="loading" @refresh="fetchLogs" />
		</template>

		<template #filter>
			<FilterBar :clear-count="activeFilterCount" @clear="onResetFilter">
				<div class="df-filter-item">
					<label class="df-filter-label">操作类型</label>
					<el-select v-model="filterType" placeholder="全部类型" clearable @change="onFilterChange">
						<el-option label="全部" :value="''" />
						<el-option v-for="t in LOG_TYPE_META" :key="t.code" :label="t.label" :value="t.code">
							<span class="log-type-option">
								<el-icon :style="{ color: t.color }">
									<component :is="t.icon" />
								</el-icon>
								{{ t.label }}
							</span>
						</el-option>
					</el-select>
				</div>
				<div class="df-filter-item">
					<label class="df-filter-label">关键词</label>
					<el-input
v-model="filterKeyword" placeholder="搜索操作人 / 描述 / 组名..." clearable @keyup.enter="onFilterChange"
						@clear="onFilterChange">
						<template #prefix>
							<el-icon>
								<Search />
							</el-icon>
						</template>
					</el-input>
				</div>
				<div class="df-filter-item df-filter-item--double">
					<label class="df-filter-label">操作时间范围</label>
					<el-date-picker
v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="~"
						start-placeholder="开始日期" end-placeholder="结束日期" :clearable="true" @change="onFilterChange" />
				</div>
			</FilterBar>
		</template>

		<DataTable
v-model:page="currentPage" v-model:page-size="currentPageSize" :data="list" :columns="columns"
			:total="total" :loading="loading" :page-sizes="[10, 15, 30, 50]" empty-preset="no-logs" row-key="id" fill-height
			@page-change="onPageChange">
			<template #type="{ row }">
				<span
class="log-type-tag"
					:style="{ color: getLogTypeMeta(row.type).color, background: getLogTypeMeta(row.type).bg }">
					<el-icon class="log-type-tag__icon">
						<component :is="getLogTypeMeta(row.type).icon" />
					</el-icon>
					{{ getLogTypeMeta(row.type).label }}
				</span>
			</template>
			<template #time="{ row }">
				<span class="log-time">{{ formatTime(row.createdAt, 'YYYY-MM-DD HH:mm') }}</span>
			</template>
		</DataTable>
	</ListPageShell>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import type { TableColumn } from '~/components/DataTable.vue'
import { LOG_TYPE_META, getLogTypeMeta, type LogTypeCode } from '~/utils/log-types'
import { apiGetLogs } from '~/api/logs'
import { formatTime } from '~/utils/format'
import type { LogItem } from '~/types/log'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
	middleware: defineNuxtRouteMiddleware(() => {
		const { can } = useAuth()
		if (!can('log:read')) {
			return navigateTo('/docs')
		}
	}),
})
useHead({ title: '操作日志 - DocFlow' })

// ── 筛选状态 ──
const filterType = ref<LogTypeCode | ''>('')
const filterKeyword = ref('')
const dateRange = ref<[string, string] | null>(null)

// ── 分页状态 ──
const currentPage = ref(1)
const currentPageSize = ref(10)

// ── 数据 ──
const list = ref<LogItem[]>([])
const total = ref(0)
const loading = ref(false)

const activeFilterCount = computed(() => {
	let n = 0
	if (filterType.value) n++
	if (filterKeyword.value) n++
	if (dateRange.value) n++
	return n
})

const columns: TableColumn[] = [
	{ label: '操作类型', slot: 'type', width: 130 },
	{ prop: 'actorName', label: '操作人', width: 120 },
	{ prop: 'description', label: '操作描述', minWidth: 320 },
	{ prop: 'groupName', label: '所属组', width: 160 },
	{ label: '操作时间', slot: 'time', width: 160 },
]

async function fetchLogs() {
	loading.value = true
	try {
		const res = await apiGetLogs({
			type: filterType.value || undefined,
			keyword: filterKeyword.value || undefined,
			startAt: dateRange.value?.[0] || undefined,
			endAt: dateRange.value?.[1] || undefined,
			page: currentPage.value,
			pageSize: currentPageSize.value,
		})
		if (res.success) {
			list.value = res.data.list
			total.value = res.data.total
		} else {
			msgError(res.message || '加载失败')
		}
	} catch {
		msgError('加载失败')
	} finally {
		loading.value = false
	}
}

function onFilterChange() {
	currentPage.value = 1
	fetchLogs()
}

function onResetFilter() {
	filterType.value = ''
	filterKeyword.value = ''
	dateRange.value = null
	currentPage.value = 1
	fetchLogs()
}

function onPageChange() {
	fetchLogs()
}

onMounted(fetchLogs)
</script>

<style lang="scss" scoped>
.log-type-tag {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 10px;
	border-radius: 10px;
	font-size: 12px;
	font-weight: 500;
	line-height: 1.5;
}

.log-type-tag__icon {
	font-size: 13px;
}

.log-type-option {
	display: inline-flex;
	align-items: center;
	gap: 8px;
}

.log-time {
	color: var(--df-subtext);
	font-size: 12px;
	font-variant-numeric: tabular-nums;
}
</style>
