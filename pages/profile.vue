<template>
	<ListPageShell>
		<template #header>
			<PageTitle title="个人中心" subtitle="我创建的、分享给我的、个人收藏、离职交接" :refreshing="loading" @refresh="load" />
		</template>

		<template #filter>
			<div class="profile-toolbar">
				<TabBar v-model="tab" :tabs="tabs" @update:model-value="onTabChange" />
				<FilterBar v-if="statusFilterEnabled" :clear-count="activeFilterCount" @clear="onResetFilter">
					<div class="df-filter-item">
						<label class="df-filter-label">状态</label>
						<el-select
v-model="filterStatus" placeholder="全部状态" clearable @change="onFilterChange"
							@clear="onFilterChange">
							<el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
						</el-select>
					</div>
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
				</FilterBar>
			</div>
		</template>

		<!-- 离职移交：手风琴视图 -->
		<div v-if="tab === 'handover'" class="profile-handover-body">
			<el-scrollbar>
				<div class="profile-handover-inner">
					<EmptyState v-if="handoverForbidden" preset="no-content" title="无权访问" description="离职交接仅部门负责人可见" />
					<HandoverAccordion v-else-if="!loading" :groups="handoverGroups" @view="onView" />
				</div>
			</el-scrollbar>
		</div>

		<!-- 普通 Tab：DataTable -->
		<DataTable
v-else v-model:page="page" v-model:page-size="pageSize" :data="list" :columns="columns" :total="total"
			:loading="loading" :page-sizes="[10, 15, 30, 50]" :empty-preset="emptyPreset" row-key="id" fill-height
			:action-width="180" @page-change="onPageChange">
			<template #title="{ row }">
				<div class="profile-title">
					<div class="profile-file-icon" :class="getFileTypeClass(row.ext)">
						{{ getFileTypeLabel(row.ext) }}
					</div>
					<span class="profile-title-name" :title="row.title">{{ row.title }}</span>
				</div>
			</template>
			<template #source="{ row }">
				<span v-if="tab === 'all'" class="profile-source">
					<span
class="profile-source-badge"
						:style="{ color: getItemSourceMeta(row.source).color, background: getItemSourceMeta(row.source).bg }">
						{{ getItemSourceMeta(row.source).label }}
					</span>
					<span
v-if="row.source === 'shared' && row.permissionLevel" class="profile-source-badge"
						:style="{ color: getPermissionLevelMeta(row.permissionLevel).color, background: getPermissionLevelMeta(row.permissionLevel).bg }">
						{{ getPermissionLevelMeta(row.permissionLevel).label }}
					</span>
				</span>
				<span
v-else-if="tab === 'shared' && row.permissionLevel" class="profile-source-badge"
					:style="{ color: getPermissionLevelMeta(row.permissionLevel).color, background: getPermissionLevelMeta(row.permissionLevel).bg }">
					{{ getPermissionLevelMeta(row.permissionLevel).label }}
				</span>
				<span v-else class="profile-muted">—</span>
			</template>
			<template #status="{ row }">
				<span
class="profile-status-badge"
					:style="{ color: getDocStatusMeta(row.status).color, background: getDocStatusMeta(row.status).bg }">
					{{ getDocStatusMeta(row.status).label }}
				</span>
			</template>
			<template #updatedAt="{ row }">
				<span class="profile-time">{{ formatTime(row.updatedAt, 'YYYY-MM-DD HH:mm') }}</span>
			</template>
			<template #action="{ row }">
				<template v-for="act in getRowActions(row)" :key="act.kind">
					<el-button
:type="act.type === 'default' ? '' : act.type" text size="small"
						:loading="busyId === row.id && busyKind === act.kind" :disabled="busyId != null && busyId !== row.id"
						@click="onActionClick(row, act.kind)">
						{{ act.label }}
					</el-button>
				</template>
			</template>
		</DataTable>

		<!-- 分享链接弹窗 -->
		<ShareLinkModal
v-if="shareTarget" v-model="shareModalVisible" :document-id="shareTarget.id"
			:file-name="`${shareTarget.title}.${shareTarget.ext || 'md'}`" />
	</ListPageShell>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import type { TableColumn } from '~/components/DataTable.vue'
import { formatTime } from '~/utils/format'
import { getFileTypeClass, getFileTypeLabel } from '~/utils/file-type'
import {
	getDocStatusMeta,
	getItemSourceMeta,
	getPermissionLevelMeta,
} from '~/utils/doc-meta'
import { getActions, type ActionKind } from '~/utils/personal-matrix'
import { apiGetPersonalDocs, apiGetPersonalHandover, apiDeleteDraft } from '~/api/personal'
import { apiDownloadDocumentUrl } from '~/api/documents'
import type {
	PersonalDocItem,
	HandoverGroup,
	PersonalTab,
	PersonalListQuery,
} from '~/types/personal'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
})
useHead({ title: '个人中心 - DocFlow' })

const authStore = useAuthStore()
const currentUserId = computed(() => authStore.user?.id ?? 0)

// 「离职移交」Tab 严格按 PRD §6.5.2 「仅部门负责人可见」—— 非 dept_head 用户不展示
const { hasRole } = useAuth()
const canViewHandover = computed(() => hasRole('dept_head'))

const allTabs: Array<{ value: PersonalTab; label: string }> = [
	{ value: 'all', label: '全部' },
	{ value: 'mine', label: '我创建的' },
	{ value: 'shared', label: '分享给我的' },
	{ value: 'favorite', label: '个人收藏' },
	{ value: 'handover', label: '离职移交' },
]
const tabs = computed(() => allTabs.filter(t => t.value !== 'handover' || canViewHandover.value))

const tab = ref<PersonalTab>('all')

// 无权访问离职移交却当前选中 → 回退到"全部"
watch(canViewHandover, (can) => {
	if (!can && tab.value === 'handover') {
		tab.value = 'all'
		load()
	}
}, { immediate: true })
const filterStatus = ref<1 | 2 | 3 | 4 | null>(null)
const filterKeyword = ref('')

// handover 特殊状态
const handoverGroups = ref<HandoverGroup[]>([])
const handoverForbidden = ref(false)

// handover tab 下不显示状态筛选
const statusFilterEnabled = computed(() => tab.value !== 'handover')

const activeFilterCount = computed(() => {
	let n = 0
	if (filterStatus.value != null) n++
	if (filterKeyword.value) n++
	return n
})

const statusOptions: Array<{ label: string; value: 1 | 2 | 3 | 4 }> = [
	{ value: 1, label: '草稿' },
	{ value: 2, label: '编辑中' },
	{ value: 3, label: '审批中' },
	{ value: 4, label: '已发布' },
]

const emptyPreset = computed(() => {
	if (filterStatus.value != null || filterKeyword.value) return 'no-results'
	if (tab.value === 'mine') return 'no-files'
	if (tab.value === 'shared') return 'no-files'
	if (tab.value === 'favorite') return 'no-files'
	return 'no-content'
})

const columns: TableColumn[] = [
	{ label: '文件名', slot: 'title', minWidth: 280 },
	{ label: '来源', slot: 'source', width: 160 },
	{ prop: 'versionNo', label: '版本', width: 80, align: 'center' },
	{ prop: 'ownerName', label: '创建人', width: 120 },
	{ label: '状态', slot: 'status', width: 100, align: 'center' },
	{ prop: 'groupName', label: '所属组', width: 160 },
	{ label: '更新时间', slot: 'updatedAt', width: 160 },
]

// 加载操作态
const busyId = ref<number | null>(null)
const busyKind = ref<ActionKind | null>(null)

// ── 非 handover tab：走 useListPage ──
const {
	page,
	pageSize,
	list,
	total,
	loading: listLoading,
	refresh: refetchList,
	onFilterChange: triggerListRefetch,
	onPageChange,
} = useListPage<PersonalDocItem, Omit<PersonalListQuery, 'tab'> & { tab: 'all' | 'mine' | 'shared' | 'favorite' }>({
	fetchFn: apiGetPersonalDocs,
	buildQuery: ({ page, pageSize }) => ({
		tab: tab.value === 'handover' ? 'all' : tab.value,
		status: statusFilterEnabled.value ? (filterStatus.value ?? undefined) : undefined,
		keyword: filterKeyword.value || undefined,
		page,
		pageSize,
	}),
	resetFilters: () => {
		filterStatus.value = null
		filterKeyword.value = ''
	},
	immediate: false, // 首次加载由 onMounted 分发到对应分支
})

// ── handover tab：单独拉取 ──
const handoverLoading = ref(false)
async function refetchHandover() {
	handoverLoading.value = true
	handoverForbidden.value = false
	try {
		const res = await apiGetPersonalHandover({
			keyword: filterKeyword.value || undefined,
			page: 1,
			pageSize: 100, // 离职人员数量有限，一次拿全
		})
		if (res.success) {
			handoverGroups.value = res.data.list
		} else if (res.code === 'HANDOVER_NOT_DEPT_HEAD') {
			handoverForbidden.value = true
			handoverGroups.value = []
		} else {
			msgError(res.message || '加载失败')
			handoverGroups.value = []
		}
	} catch {
		msgError('加载失败')
		handoverGroups.value = []
	} finally {
		handoverLoading.value = false
	}
}

// 对外统一的 loading / refresh 入口
const loading = computed(() => (tab.value === 'handover' ? handoverLoading.value : listLoading.value))
function load() {
	if (tab.value === 'handover') refetchHandover()
	else refetchList()
}

function onFilterChange() {
	if (tab.value === 'handover') refetchHandover()
	else triggerListRefetch()
}

function onResetFilter() {
	filterStatus.value = null
	filterKeyword.value = ''
	if (tab.value === 'handover') refetchHandover()
	else triggerListRefetch()
}

function onTabChange() {
	filterStatus.value = null
	filterKeyword.value = ''
	handoverGroups.value = []
	handoverForbidden.value = false
	load()
}

onMounted(load)

// ── 行操作 ──
function getRowActions(doc: PersonalDocItem) {
	return getActions(doc, currentUserId.value)
}

function onView(doc: PersonalDocItem) {
	navigateTo(`/docs/file/${doc.id}`)
}

async function onActionClick(doc: PersonalDocItem, kind: ActionKind) {
	if (kind === 'view') return onView(doc)
	if (kind === 'download') return onDownload(doc)
	if (kind === 'share') return onShare(doc)
	if (kind === 'withdraw') return onWithdraw(doc)
	if (kind === 'delete') return onDelete(doc)
}

function onDownload(doc: PersonalDocItem) {
	window.location.href = apiDownloadDocumentUrl(doc.id)
}

// ── 分享 ──
const shareModalVisible = ref(false)
const shareTarget = ref<PersonalDocItem | null>(null)

function onShare(doc: PersonalDocItem) {
	shareTarget.value = doc
	shareModalVisible.value = true
}

async function onWithdraw(doc: PersonalDocItem) {
	// 个人中心"撤回"对应"审批中"文档 → 查 approval instance id
	// 简化实现：直接把 doc.id 传 withdraw 接口是不对的，需先查 instance id
	// 但本 A 阶段范围不含"通过 documentId 找 active instance"的新接口
	// 权宜做法：提示用户去审批中心操作，保留 UI 入口但不直接调 API
	const ok = await msgConfirm(
		`请前往审批中心撤回「${doc.title}」的审批。`,
		'撤回审批',
		{ type: 'info', confirmText: '去审批中心' },
	)
	if (ok) navigateTo('/approvals?tab=submitted')
}

async function onDelete(doc: PersonalDocItem) {
	const ok = await msgConfirm(
		`确定删除「${doc.title}」？草稿将进入个人回收站，30 天内可恢复。`,
		'删除草稿',
		{ type: 'warning', confirmText: '删除', danger: true },
	)
	if (!ok) return
	busyId.value = doc.id
	busyKind.value = 'delete'
	try {
		const res = await apiDeleteDraft(doc.id)
		if (res.success) {
			msgSuccess(res.message || '已进入个人回收站，30天内可恢复')
			load()
		} else {
			msgError(res.message || '删除失败')
		}
	} catch {
		msgError('删除失败')
	} finally {
		busyId.value = null
		busyKind.value = null
	}
}
</script>

<style lang="scss" scoped>
.profile-toolbar {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.profile-handover-body {
	flex: 1;
	min-height: 0;
}

.profile-handover-inner {
	padding: 4px 12px 4px 0;
}

.profile-title {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.profile-file-icon {
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

.profile-title-name {
	color: var(--df-text);
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	cursor: pointer;

	&:hover {
		color: var(--df-primary);
	}
}

.profile-source {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	flex-wrap: wrap;
}

.profile-source-badge,
.profile-status-badge {
	display: inline-flex;
	align-items: center;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 12px;
	font-weight: 500;
	line-height: 1.5;
}

.profile-time {
	color: var(--df-subtext);
	font-size: 12px;
	font-variant-numeric: tabular-nums;
}

.profile-muted {
	color: var(--df-border);
}
</style>
