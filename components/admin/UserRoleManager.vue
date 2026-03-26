<template>
	<div class="user-role-manager">
		<DataTable :data="list" :columns="columns" :loading="loading" :total="total" :page="page" :page-size="pageSize"
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

			<!-- 角色标签 -->
			<template #roleName="{ row }">
				<el-tag size="small" disable-transitions>{{ row.roleName }}</el-tag>
			</template>

			<!-- 操作 -->
			<template #action="{ row }">
				<el-button v-auth="'role:assign'" link type="danger" size="small" :loading="revokingId === row.id"
					@click="handleRevoke(row)">
					撤销
				</el-button>
			</template>
		</DataTable>

		<!-- ── 分配角色弹窗 ── -->
		<Modal v-model="assignDialogVisible" title="分配角色" :confirm-loading="assigning" @confirm="handleAssign">
			<el-form label-width="80px">
				<el-form-item label="用户">
					<el-select v-model="assignForm.userId" filterable remote :remote-method="searchUsers"
						:loading="searchingUsers" placeholder="输入用户名或邮箱搜索" style="width: 100%">
						<el-option v-for="u in userOptions" :key="u.id" :label="`${u.name}${u.email ? ' (' + u.email + ')' : ''}`"
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
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { UserRoleItem } from '~/types/rbac'
import {
	apiGetRoles, apiGetUserRoles, apiAssignUserRole,
	apiRevokeUserRole, apiSearchUsers,
} from '~/api/rbac'

// ── 表格列 ──
const columns = [
	{ prop: 'userName', label: '用户名', minWidth: 120 },
	{ prop: 'userEmail', label: '邮箱', minWidth: 160 },
	{ prop: 'roleName', label: '角色', width: 140, slot: 'roleName' },
	{ prop: 'createdAt', label: '分配时间', width: 170, dateFormat: 'datetime' }
]

// ── 数据状态 ──
const loading = ref(false)
const list = ref<UserRoleItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const filterRoleId = ref<number | ''>('')
const revokingId = ref<number | null>(null)

// ── 角色选项（用于筛选和分配） ──
const roleOptions = ref<Array<{ id: number; name: string; code: string }>>([])

// ── 分配弹窗 ──
const assignDialogVisible = ref(false)
const assigning = ref(false)
const assignForm = reactive({ userId: null as number | null, roleId: null as number | null })
const userOptions = ref<Array<{ id: number; name: string; email: string | null }>>([])
const searchingUsers = ref(false)

// ── 加载列表 ──
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
		ElMessage.error('加载用户角色列表失败')
	} finally {
		loading.value = false
	}
}

function onSearch(kw: string) {
	keyword.value = kw
	if (page.value !== 1) {
		page.value = 1 // watch 会触发 loadList
	} else {
		loadList()
	}
}

// 分页变更——跳过 hydration 阶段的虚假触发
let _mounted = false
watch([() => page.value, () => pageSize.value], () => {
	if (_mounted) loadList()
})

onMounted(() => {
	_mounted = true
	loadList()
})

function onFilterChange() {
	page.value = 1
	loadList()
}

// ── 加载角色选项 ──
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

// ── 搜索用户 ──
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

// ── 打开分配弹窗 ──
function openAssignDialog() {
	assignForm.userId = null
	assignForm.roleId = null
	userOptions.value = []
	assignDialogVisible.value = true
}

// ── 执行分配 ──
async function handleAssign() {
	if (!assignForm.userId || !assignForm.roleId) {
		ElMessage.warning('请选择用户和角色')
		return
	}

	assigning.value = true
	try {
		const res = await apiAssignUserRole(assignForm.userId, assignForm.roleId)
		if (res.success) {
			ElMessage.success('角色分配成功')
			assignDialogVisible.value = false
			loadList()
		} else {
			ElMessage.error(res.message || '分配失败')
		}
	} catch {
		ElMessage.error('操作失败')
	} finally {
		assigning.value = false
	}
}

// ── 撤销角色 ──
async function handleRevoke(row: UserRoleItem) {
	try {
		await ElMessageBox.confirm(
			`确定撤销用户「${row.userName}」的「${row.roleName}」角色？`,
			'撤销确认',
			{ type: 'warning', confirmButtonText: '撤销', cancelButtonText: '取消' }
		)
	} catch {
		return // 用户取消
	}

	revokingId.value = row.id
	try {
		const res = await apiRevokeUserRole(row.userId, row.roleId)
		if (res.success) {
			ElMessage.success('角色已撤销')
			loadList()
		} else {
			ElMessage.error(res.message || '撤销失败')
		}
	} catch {
		ElMessage.error('撤销失败')
	} finally {
		revokingId.value = null
	}
}

// ── 初始化 ──
onMounted(() => {
	loadRoleOptions()
})

// ── 暴露给父组件 ──
defineExpose({ refresh: loadList, loading })
</script>

<style lang="scss" scoped>
.mr-1 {
	margin-right: 4px;
}
</style>
