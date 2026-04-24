<template>
	<ListPageShell>
		<template #header>
			<PageTitle :title="groupName || '仓库详情'" :subtitle="groupSubtitle" :refreshing="loading" @refresh="refresh">
				<template #actions>
					<el-button @click="navigateTo('/docs')">
						<el-icon>
							<Back />
						</el-icon>
						返回仓库列表
					</el-button>
					<el-button v-auth="'doc:create'" type="primary" @click="uploadVisible = true">
						<el-icon>
							<Upload />
						</el-icon>
						上传文件
					</el-button>
					<el-button disabled title="飞书导入功能规划中">
						<el-icon>
							<Link />
						</el-icon>
						导入飞书
					</el-button>
				</template>
			</PageTitle>
		</template>

		<template #filter>
			<FilterBar :clear-count="filterGroupClearCount" @clear="onResetFilter">
				<div class="df-filter-item df-filter-item--double">
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
			</FilterBar>
		</template>

		<div v-if="reviewingCount > 0" class="repo-reviewing-banner">
			<el-icon>
				<WarningFilled />
			</el-icon>
			<span>
				当前有 <strong>{{ reviewingCount }}</strong> 个文件正在审批中，审批通过后会自动出现在此列表
			</span>
		</div>

		<DataTable
v-model:page="currentPage" v-model:page-size="currentPageSize" :data="list" :columns="columns"
			:total="total" :loading="loading" :page-sizes="[10, 15, 30, 50]" empty-preset="no-docs" row-key="id" fill-height
			@page-change="onPageChange">
			<template #title="{ row }">
				<div class="repo-title-cell">
					<div class="repo-file-icon" :class="fileIconClass(row)">
						{{ (row.ext || 'FILE').toUpperCase().slice(0, 3) }}
					</div>
					<div class="repo-title-text">
						<NuxtLink :to="`/docs/file/${row.id}`" class="repo-title-link">
							{{ row.title }}
						</NuxtLink>
						<div v-if="row.isPinned || row.isFavorited" class="repo-title-flags">
							<el-icon v-if="row.isPinned" title="已置顶" color="var(--df-primary)">
								<Top />
							</el-icon>
							<el-icon v-if="row.isFavorited" title="已收藏" color="#f59e0b">
								<Star />
							</el-icon>
						</div>
					</div>
				</div>
			</template>
			<template #version="{ row }">
				<span class="repo-version">{{ row.versionNo || '—' }}</span>
			</template>
			<template #updatedAt="{ row }">
				<span class="repo-time">{{ formatTime(row.updatedAt, 'YYYY-MM-DD HH:mm') }}</span>
			</template>
			<template #actions="{ row }">
				<div class="repo-row-actions">
					<el-button link type="primary" @click="navigateTo(`/docs/file/${row.id}`)">
						详情
					</el-button>
					<el-dropdown trigger="click" @command="onRowCommand($event, row)">
						<el-button link>
							更多
							<el-icon>
								<MoreFilled />
							</el-icon>
						</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item command="download" :icon="Download">下载</el-dropdown-item>
								<el-dropdown-item v-if="canRemove" command="remove" :icon="Delete" divided style="color: #ef4444">
									从组移除
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</div>
			</template>
		</DataTable>

		<UploadFileModal v-model="uploadVisible" :group-id="groupId" mode="first" @success="onUploadSuccess" />
	</ListPageShell>
</template>

<script setup lang="ts">
import {
	Back,
	Upload,
	Link,
	Search,
	WarningFilled,
	Top,
	Star,
	MoreFilled,
	Download,
	Delete,
} from '@element-plus/icons-vue'
import type { TableColumn } from '~/components/DataTable.vue'
import { apiGetDocuments, apiRemoveDocument, apiDownloadDocumentUrl } from '~/api/documents'
import { apiGetGroup } from '~/api/groups'
import type { DocumentListItem } from '~/types/document'
import type { DocumentListQuery } from '~/server/schemas/document'
import type { ApiResult, PaginatedData } from '~/types/api'
import { formatTime } from '~/utils/format'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
})
useHead({ title: '仓库详情 - DocFlow' })

const route = useRoute()
const groupId = computed(() => Number(route.params.id))
const { can } = useAuth()
const canRemove = computed(() => can('doc:remove'))

// ── 筛选 ──
const filterKeyword = ref('')
const filterGroupClearCount = computed(() => (filterKeyword.value ? 1 : 0))

// ── 列表 + reviewingCount（透过 useListPage，但 reviewingCount 需要外挂） ──
const reviewingCount = ref(0)

/** 包装 apiGetDocuments：side-load reviewingCount，对外返回 PaginatedData 形状 */
function fetchWithReviewingCount(
	params: DocumentListQuery,
): Promise<ApiResult<PaginatedData<DocumentListItem>>> {
	return apiGetDocuments(params).then((res) => {
		if (res.success) reviewingCount.value = res.data.reviewingCount
		return res
	})
}

const columns: TableColumn[] = [
	{ label: '文件名', slot: 'title', minWidth: 280 },
	{ label: '版本', slot: 'version', width: 100 },
	{ prop: 'ownerName', label: '归属人', width: 120 },
	{ label: '更新时间', slot: 'updatedAt', width: 160 },
	{ label: '操作', slot: 'actions', width: 160, fixed: 'right' },
]

const {
	page: currentPage,
	pageSize: currentPageSize,
	list,
	total,
	loading,
	refresh,
	onFilterChange,
	onResetFilter,
	onPageChange,
} = useListPage<DocumentListItem, DocumentListQuery>({
	fetchFn: fetchWithReviewingCount,
	buildQuery: ({ page, pageSize }) => ({
		groupId: groupId.value,
		status: 4,
		keyword: filterKeyword.value || undefined,
		page,
		pageSize,
	}),
	resetFilters: () => {
		filterKeyword.value = ''
	},
})

// ── 组基础信息（标题 + 副标题） ──
const groupName = ref('')
const groupSubtitle = ref('文件列表')

onMounted(async () => {
	const res = await apiGetGroup(groupId.value)
	if (res.success) {
		groupName.value = res.data.name
		groupSubtitle.value = `${res.data.fileCount} 份文件 · 归属人 ${res.data.ownerName}`
	}
})

// ── 上传 ──
const uploadVisible = ref(false)

function onUploadSuccess() {
	refresh()
}

// ── 行操作 ──
function fileIconClass(row: DocumentListItem): string {
	const e = (row.ext || '').toLowerCase()
	if (e === 'md') return 'is-md'
	if (e === 'pdf') return 'is-pdf'
	if (e === 'docx' || e === 'doc') return 'is-word'
	if (e === 'xlsx' || e === 'xls') return 'is-excel'
	return 'is-other'
}

async function onRowCommand(cmd: string | number | object, row: DocumentListItem) {
	if (cmd === 'download') {
		window.location.href = apiDownloadDocumentUrl(row.id)
	} else if (cmd === 'remove') {
		await onRemove(row)
	}
}

async function onRemove(row: DocumentListItem) {
	const ok = await msgConfirm(
		`从组移除后，文件「${row.title}」将退回归属人 ${row.ownerName} 的个人中心（可被恢复）。`,
		'确认移除',
		{ type: 'warning', confirmText: '确认移除', danger: true },
	)
	if (!ok) return
	try {
		const res = await apiRemoveDocument(row.id)
		if (res.success) {
			msgSuccess(res.message || '已从组移除')
			refresh()
		} else {
			msgError(res.message || '移除失败')
		}
	} catch {
		msgError('移除失败')
	}
}
</script>

<style lang="scss" scoped>
.repo-reviewing-banner {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 14px;
	margin-bottom: 12px;
	background: #fffbeb;
	border: 1px solid #fde68a;
	border-radius: 8px;
	color: #92400e;
	font-size: 13px;

	.el-icon {
		font-size: 16px;
		color: #f59e0b;
	}

	strong {
		font-weight: 600;
	}
}

.repo-title-cell {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.repo-file-icon {
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

	&.is-md {
		background: #8b5cf6;
	}

	&.is-pdf {
		background: #ef4444;
	}

	&.is-word {
		background: #2563eb;
	}

	&.is-excel {
		background: #10b981;
	}
}

.repo-title-text {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.repo-title-link {
	color: var(--df-text);
	text-decoration: none;
	font-weight: 500;
	font-size: 14px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;

	&:hover {
		color: var(--df-primary);
	}
}

.repo-title-flags {
	display: inline-flex;
	gap: 4px;

	.el-icon {
		font-size: 13px;
	}
}

.repo-version {
	color: var(--df-primary);
	font-variant-numeric: tabular-nums;
	font-size: 13px;
}

.repo-time {
	color: var(--df-subtext);
	font-size: 12px;
	font-variant-numeric: tabular-nums;
}

.repo-row-actions {
	display: flex;
	align-items: center;
	gap: 4px;
}
</style>
