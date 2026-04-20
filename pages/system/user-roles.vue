<!--
  通用 RBAC 用户-角色分配页面（framework 层）

  — DocFlow 业务不暴露此菜单入口（见 layouts/prototype.vue 菜单注释）
  — 抽离为 nuxt-fullstack-starter 模板时启用对应侧栏菜单即可
  — 页面逻辑保持与原 components/admin/UserRoleManager.vue 一致
-->
<template>
	<section class="pf-page-stack">
		<PageTitle title="RBAC 用户授权" subtitle="通用 RBAC 底座 — 用户 × 角色分配" :refreshing="loading" @refresh="loadList" />

		<div class="user-role-manager">
			<DataTable
:data="list" :columns="columns" :loading="loading" :total="total" :page="page" :page-size="pageSize"
				show-search search-placeholder="搜索用户名或邮箱…" @update:page="page = $event" @update:page-size="pageSize = $event"
				@search="onSearch">
				<template #toolbar>
					<el-select v-model="filterRoleId" placeholder="按角色筛选" clearable style="width: 160px" @change="onFilterChange">
						<el-option v-for="r in roleOptions" :key="r.id" :label="r.name" :value="r.id" />
					</el-select>
					<el-button v-auth="'role:assign'" type="primary" @click="openAssignDialog">
						<el-icon class="mr-1">
							<Plus />
						</el-icon>
						分配角色
					</el-button>
				</template>

				<template #roleName="{ row }">
					<el-tag size="small" disable-transitions>{{ row.roleName }}</el-tag>
				</template>

				<template #action="{ row }">
					<el-button
v-auth="'role:assign'" link type="danger" size="small" :loading="revokingId === row.id"
						@click="handleRevoke(row)">
						撤销
					</el-button>
				</template>
			</DataTable>

			<Modal v-model="assignDialogVisible" title="分配角色" :confirm-loading="assigning" @confirm="handleAssign">
				<el-form label-width="80px">
					<el-form-item label="用户">
						<el-select
v-model="assignForm.userId" filterable remote :remote-method="searchUsers"
							:loading="searchingUsers" placeholder="输入用户名或邮箱搜索" style="width: 100%">
							<el-option
v-for="u in userOptions" :key="u.id" :label="`${u.name}${u.email ? ' (' + u.email + ')' : ''}`"
								:value="u.id" />
						</el-select>
					</el-form-item>
					<el-form-item label="角色">
						<el-select v-model="assignForm.roleId" placeholder="选择角色" style="width: 100%">
							<el-option v-for="r in roleOptions" :key="r.id" :label="r.name" :value="r.id" />
						</el-select>
					</el-form-item>
				</el-form>
			</Modal>
		</div>
	</section>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { UserRoleItem } from '~/types/rbac'
import {
	apiGetRoles, apiGetUserRoles, apiAssignUserRole,
	apiRevokeUserRole, apiSearchUsers,
} from '~/api/rbac'

definePageMeta({
	layout: 'prototype',
	middleware: defineNuxtRouteMiddleware(() => {
		const { can } = useAuth()
		if (!can('role:assign')) {
			return navigateTo('/docs')
		}
	}),
})
useHead({ title: 'RBAC 用户授权 - DocFlow' })

const columns = [
	{ prop: 'userName', label: '用户名', minWidth: 120 },
	{ prop: 'userEmail', label: '邮箱', minWidth: 160 },
	{ prop: 'roleName', label: '角色', width: 140, slot: 'roleName' },
	{ prop: 'createdAt', label: '分配时间', width: 170, dateFormat: 'datetime' }
]

const loading = ref(false)
const list = ref<UserRoleItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const filterRoleId = ref<number | ''>('')
const revokingId = ref<number | null>(null)

const roleOptions = ref<Array<{ id: number; name: string; code: string }>>([])

const assignDialogVisible = ref(false)
const assigning = ref(false)
const assignForm = reactive({ userId: null as number | null, roleId: null as number | null })
const userOptions = ref<Array<{ id: number; name: string; email: string | null }>>([])
const searchingUsers = ref(false)

async function loadList() {
	loading.value = true
	try {
		const res = await apiGetUserRoles({
			page: page.value,
			pageSize: pageSize.value,
			keyword: keyword.value || undefined,
			roleId: filterRoleId.value ? Number(filterRoleId.value) : undefined,
		})

		if (res.success && res.data) {
			list.value = res.data.list
			total.value = res.data.total
		}
	} catch {
		msgError('加载用户角色列表失败')
	} finally {
		loading.value = false
	}
}

function onSearch(kw: string) {
	keyword.value = kw
	if (page.value !== 1) {
		page.value = 1
	} else {
		loadList()
	}
}

let _mounted = false
watch([() => page.value, () => pageSize.value], () => {
	if (_mounted) loadList()
})

onMounted(() => {
	_mounted = true
	loadList()
	loadRoleOptions()
})

function onFilterChange() {
	page.value = 1
	loadList()
}

async function loadRoleOptions() {
	try {
		const res = await apiGetRoles({ pageSize: 100 })

		if (res.success && res.data) {
			roleOptions.value = res.data.list.map(r => ({
				id: r.id,
				name: r.name,
				code: r.code
			}))
		}
	} catch {
		// 静默
	}
}

async function searchUsers(query: string) {
	if (!query) {
		userOptions.value = []
		return
	}
	searchingUsers.value = true
	try {
		const res = await apiSearchUsers(query)

		if (res.success && res.data) {
			userOptions.value = res.data
		}
	} catch {
		// 静默
	} finally {
		searchingUsers.value = false
	}
}

function openAssignDialog() {
	assignForm.userId = null
	assignForm.roleId = null
	userOptions.value = []
	assignDialogVisible.value = true
}

async function handleAssign() {
	if (!assignForm.userId || !assignForm.roleId) {
		msgWarning('请选择用户和角色')
		return
	}

	assigning.value = true
	try {
		const res = await apiAssignUserRole(assignForm.userId, assignForm.roleId)
		if (res.success) {
			msgSuccess(res.message || '角色分配成功')
			assignDialogVisible.value = false
			loadList()
		} else {
			msgError(res.message || '分配失败')
		}
	} catch {
		msgError('操作失败')
	} finally {
		assigning.value = false
	}
}

async function handleRevoke(row: UserRoleItem) {
	const confirmed = await msgConfirm(
		`确定撤销用户「${row.userName}」的「${row.roleName}」角色？`,
		'撤销确认',
		{ confirmText: '撤销', danger: true },
	)
	if (!confirmed) return

	revokingId.value = row.id
	try {
		const res = await apiRevokeUserRole(row.userId, row.roleId)
		if (res.success) {
			msgSuccess(res.message || '角色已撤销')
			loadList()
		} else {
			msgError(res.message || '撤销失败')
		}
	} catch {
		msgError('撤销失败')
	} finally {
		revokingId.value = null
	}
}
</script>

<style lang="scss" scoped>
.mr-1 {
	margin-right: 4px;
}
</style>
