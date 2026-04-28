<template>
	<ListPageShell>
		<template #header>
			<PageTitle title="系统管理" subtitle="公司层管理员 / 产品线负责人指派" :refreshing="loading" @refresh="refresh">
				<template #actions>
					<el-button :loading="syncing" @click="onSyncFeishu">
						<el-icon class="admin-btn-icon">
							<Refresh />
						</el-icon>
						同步飞书通讯录
					</el-button>
				</template>
			</PageTitle>
		</template>

		<template #filter>
			<FilterBar :clear-count="activeFilterCount" @clear="onResetFilter">
				<div class="df-filter-item">
					<label class="df-filter-label">关键词</label>
					<el-input
v-model="filterKeyword" placeholder="搜索姓名或邮箱..." clearable @keyup.enter="onFilterChange"
						@clear="onFilterChange">
						<template #prefix>
							<el-icon>
								<Search />
							</el-icon>
						</template>
					</el-input>
				</div>

				<div class="df-filter-item">
					<label class="df-filter-label">系统角色</label>
					<el-select
v-model="filterRoles" multiple collapse-tags collapse-tags-tooltip placeholder="全部角色" clearable
						@change="onFilterChange">
						<el-option v-for="o in ROLE_FILTER_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
					</el-select>
				</div>

				<div class="df-filter-item">
					<label class="df-filter-label">状态</label>
					<el-select v-model="filterStatus" @change="onFilterChange">
						<el-option v-for="o in STATUS_FILTER_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
					</el-select>
				</div>
			</FilterBar>
		</template>

		<DataTable
v-model:page="currentPage" v-model:page-size="currentPageSize" :data="list" :columns="columns"
			:total="total" :loading="loading" :page-sizes="[20, 50, 100]" :row-class-name="rowClassName" row-key="id"
			:action-width="160" fill-height empty-text="暂无用户" @page-change="onPageChange">

			<!-- 姓名 + 头像 -->
			<template #name="{ row }">
				<div class="admin-user-cell">
					<el-avatar v-if="row.avatarUrl" :size="28" :src="row.avatarUrl" />
					<div v-else class="admin-user-fallback">{{ (row.name || '?').charAt(0) }}</div>
					<span class="admin-user-name">{{ row.name }}</span>
				</div>
			</template>

			<!-- 系统角色（多 badge） -->
			<template #roles="{ row }">
				<div v-if="row.roles.length > 0" class="admin-role-badges">
					<span
v-for="r in row.roles" :key="r.code" class="admin-role-badge" :class="{ 'is-feishu': r.feishuSynced }"
						:style="getBadgeStyle(r.code)">
						{{ r.name }}
						<span v-if="r.feishuSynced" class="admin-role-badge__tag">飞书</span>
					</span>
				</div>
				<span v-else class="admin-empty-dash">—</span>
			</template>

			<!-- 管理范围 -->
			<template #scopes="{ row }">
				<div v-if="hasAnyScope(row)" class="admin-scopes">
					<div v-if="row.roles.some((r: AdminUserRole) => r.code === 'super_admin')" class="admin-scope-line">
						全局
					</div>
					<div v-if="row.scopes.companyAdmin" class="admin-scope-line">——</div>
					<div v-if="row.scopes.productLines.length > 0" class="admin-scope-line">
						产品线：{{row.scopes.productLines.map((p: { name: string }) => p.name).join('、')}}
					</div>
					<div v-if="row.scopes.departments.length > 0" class="admin-scope-line">
						部门：{{row.scopes.departments.map((d: { name: string }) => d.name).join('、')}}
						<span class="admin-scope-hint">(飞书同步)</span>
					</div>
				</div>
				<span v-else class="admin-empty-dash">—</span>
			</template>

			<!-- 状态 -->
			<template #status="{ row }">
				<span v-if="row.status === 1" class="admin-status admin-status--active">
					<span class="admin-status-dot" />活跃
				</span>
				<span v-else class="admin-status admin-status--inactive">
					<span class="admin-status-dot" />已停用
				</span>
			</template>

			<!-- 操作 -->
			<template #action="{ row }">
				<!-- 系统管理员行 -->
				<span v-if="isSuperAdmin(row)" class="admin-system-preset">系统预设</span>
				<!-- 已停用行 -->
				<span v-else-if="row.status === 0" class="admin-deactivated-time">
					停用时间：{{ row.deactivatedAt ? formatTime(row.deactivatedAt, 'YYYY-MM-DD') : '—' }}
				</span>
				<!-- 活跃行 -->
				<template v-else>
					<el-button v-auth="'admin:role_assign'" link type="primary" size="small" @click="onOpenAssign(row)">
						角色管理
					</el-button>
					<el-button link type="danger" size="small" @click="onDeactivateStub(row)">
						停用
					</el-button>
				</template>
			</template>
		</DataTable>

		<!-- 底部蓝色说明条 -->
		<div class="admin-info-banner">
			<strong>说明：</strong>此处可管理<strong>公司层管理员</strong>和<strong>产品线负责人</strong>。
			<strong>部门负责人</strong>由飞书组织架构同步（只读显示）。
			<strong>部门管理员</strong>由部门负责人在「部门管理」中指派。
			组负责人和组内成员在各组的成员管理中设置。
		</div>

		<!-- 角色指派弹窗 -->
		<AdminRoleAssignModal v-model:visible="assignModalVisible" :user="activeUser" @success="onAssignSuccess" />
	</ListPageShell>
</template>

<script setup lang="ts">
import { Search, Refresh } from '@element-plus/icons-vue'
import type { TableColumn } from '~/components/DataTable.vue'
import AdminRoleAssignModal from '~/components/admin/AdminRoleAssignModal.vue'
import { apiGetAdminUsers, apiSyncFeishuContacts } from '~/api/admin'
import { formatTime } from '~/utils/format'
import {
	getRoleMeta, ROLE_FILTER_OPTIONS, STATUS_FILTER_OPTIONS,
} from '~/utils/system-role-meta'
import type {
	AdminUserItem, AdminUserListQuery, AdminUserRole,
	AdminSystemRoleCode, AdminUserStatusFilter,
} from '~/types/admin'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
	middleware: defineNuxtRouteMiddleware(() => {
		const { can } = useAuth()
		if (!can('admin:user_read')) {
			return navigateTo('/docs')
		}
	}),
})
useHead({ title: '系统管理 - DocFlow' })

// ── 筛选状态 ──
const filterKeyword = ref('')
const filterRoles = ref<string[]>([])
const filterStatus = ref<AdminUserStatusFilter>('all')

const activeFilterCount = computed(() => {
	let n = 0
	if (filterKeyword.value) n++
	if (filterRoles.value.length > 0) n++
	if (filterStatus.value !== 'all') n++
	return n
})

// ── 列 ──
const columns: TableColumn[] = [
	{ label: '姓名', slot: 'name', minWidth: 140, fixed: 'left' },
	{ prop: 'email', label: '邮箱', minWidth: 180, showOverflowTooltip: true },
	{ label: '系统角色', slot: 'roles', minWidth: 180 },
	{ label: '管理范围', slot: 'scopes', minWidth: 220 },
	{ label: '状态', slot: 'status', width: 100, align: 'center' },
]

// ── 列表加载 ──
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
} = useListPage<AdminUserItem, AdminUserListQuery>({
	fetchFn: apiGetAdminUsers,
	defaultPageSize: 20,
	buildQuery: ({ page, pageSize }) => ({
		keyword: filterKeyword.value || undefined,
		roles: filterRoles.value.length > 0 ? filterRoles.value.join(',') : undefined,
		status: filterStatus.value,
		page,
		pageSize,
	}),
	resetFilters: () => {
		filterKeyword.value = ''
		filterRoles.value = []
		filterStatus.value = 'all'
	},
})

// ── 行样式：已停用降透明度 ──
function rowClassName({ row }: { row: Record<string, unknown> }) {
	const r = row as unknown as AdminUserItem
	return r.status === 0 ? 'admin-row-deactivated' : ''
}

// ── 角色判定 ──
function isSuperAdmin(row: AdminUserItem): boolean {
	return row.roles.some(r => r.code === 'super_admin')
}

function hasAnyScope(row: AdminUserItem): boolean {
	return (
		row.scopes.companyAdmin
		|| row.scopes.productLines.length > 0
		|| row.scopes.departments.length > 0
		|| row.roles.some(r => r.code === 'super_admin')
	)
}

function getBadgeStyle(code: AdminSystemRoleCode) {
	const meta = getRoleMeta(code)
	return {
		color: meta.color,
		background: meta.bg,
		opacity: meta.feishuSynced ? 0.85 : 1,
	}
}

// ── 角色管理弹窗 ──
const assignModalVisible = ref(false)
const activeUser = ref<AdminUserItem | null>(null)

function onOpenAssign(row: AdminUserItem) {
	activeUser.value = row
	assignModalVisible.value = true
}

function onAssignSuccess() {
	refresh()
}

// ── 停用（B 阶段做，目前 stub） ──
function onDeactivateStub(row: AdminUserItem) {
	msgWarning(`「${row.name}」停用 / 离职交接功能开发中`)
}

// ── 手动触发飞书同步 ──
const syncing = ref(false)

async function onSyncFeishu() {
	const confirmed = await msgConfirm(
		'将从飞书开放平台拉取全部部门与人员，更新至 DocFlow（首次同步可能较慢）。继续？',
		'同步飞书通讯录',
		{ confirmText: '开始同步' },
	)
	if (!confirmed) return

	syncing.value = true
	try {
		const res = await apiSyncFeishuContacts()
		if (res.success && res.data) {
			const d = res.data
			msgSuccess(
				`同步完成 — 飞书用户 ${d.total} 人 / 部门 ${d.departments} 个；`
				+ `落地 doc_users 新建 ${d.docUserCreated}，更新 ${d.docUserUpdated}；`
				+ `部门负责人识别 ${d.deptHeadAssigned} 位`,
			)
			refresh()
		} else {
			msgError(res.message || '同步失败')
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : '同步失败'
		msgError(msg)
	} finally {
		syncing.value = false
	}
}
</script>

<style lang="scss" scoped>
.admin-btn-icon {
	margin-right: 4px;
}

.admin-user-cell {
	display: flex;
	align-items: center;
	gap: 10px;
}

.admin-user-fallback {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	background: #6366f1;
	color: #fff;
	font-size: 12px;
	font-weight: 600;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.admin-user-name {
	font-weight: 500;
	color: var(--df-text);
}

.admin-empty-dash {
	color: var(--df-subtext);
}

// ── 角色 badge ──
.admin-role-badges {
	display: flex;
	flex-direction: column;
	gap: 4px;
	align-items: flex-start;
}

.admin-role-badge {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 2px 8px;
	border-radius: 4px;
	font-size: 12px;
	line-height: 1.6;
	font-weight: 500;
}

.admin-role-badge__tag {
	display: inline-flex;
	align-items: center;
	padding: 0 4px;
	font-size: 10px;
	font-weight: 400;
	background: rgba(255, 255, 255, 0.55);
	border-radius: 2px;
	opacity: 0.9;
}

// ── 管理范围 ──
.admin-scopes {
	display: flex;
	flex-direction: column;
	gap: 2px;
	font-size: 13px;
	color: var(--df-text);
	line-height: 1.6;
}

.admin-scope-line {
	color: var(--df-subtext);
}

.admin-scope-hint {
	font-size: 11px;
	color: var(--df-subtext);
	margin-left: 4px;
}

// ── 状态 ──
.admin-status {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 12px;
	font-weight: 500;
}

.admin-status-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
}

.admin-status--active {
	color: #16a34a;

	.admin-status-dot {
		background: #16a34a;
	}
}

.admin-status--inactive {
	color: var(--df-subtext);

	.admin-status-dot {
		background: #94a3b8;
	}
}

// ── 操作列 ──
.admin-system-preset,
.admin-deactivated-time {
	font-size: 12px;
	color: var(--df-subtext);
}

// ── 底部说明条 ──
.admin-info-banner {
	margin-top: 16px;
	padding: 12px 16px;
	background: var(--df-primary-soft);
	border-radius: 8px;
	font-size: 13px;
	line-height: 1.7;
	color: var(--df-primary-hover);

	strong {
		color: var(--df-primary);
		font-weight: 600;
	}
}

// ── 已停用行整体降透明（DataTable 会把 rowClassName 加到 tr 上） ──
:deep(.el-table__row.admin-row-deactivated) {
	opacity: 0.65;
}
</style>
