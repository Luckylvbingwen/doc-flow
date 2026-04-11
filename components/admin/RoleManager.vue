<template>
	<div class="role-manager">
		<!-- ── 工具栏 ── -->
		<DataTable
:data="roleList" :columns="columns" :loading="loading" :total="total" :page="page" :page-size="pageSize"
			:action-width="150" show-search search-placeholder="搜索角色名称或标识…" @update:page="page = $event"
			@update:page-size="pageSize = $event" @search="onSearch">
			<template #toolbar>
				<el-button v-auth="'role:create'" type="primary" @click="openCreateDialog">
					<el-icon class="mr-1">
						<Plus />
					</el-icon>
					新增角色
				</el-button>
			</template>

			<!-- 系统标记 -->
			<template #isSystem="{ row }">
				<el-tag v-if="row.isSystem" type="warning" size="small" disable-transitions>内置</el-tag>
				<el-tag v-else type="info" size="small" disable-transitions>自定义</el-tag>
			</template>

			<!-- 状态 -->
			<template #status="{ row }">
				<el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small" disable-transitions>
					{{ row.status === 1 ? '启用' : '停用' }}
				</el-tag>
			</template>

			<!-- 权限数 -->
			<template #permissionCount="{ row }">
				<el-button link type="primary" size="small" @click="openPermissionDialog(row)">
					{{ row.permissionCount }} 项
				</el-button>
			</template>

			<!-- 操作 -->
			<template #action="{ row }">
				<el-button v-auth="'role:update'" link type="primary" size="small" @click="openEditDialog(row)">
					编辑
				</el-button>
				<el-button v-auth="'role:update'" link type="primary" size="small" @click="openPermissionDialog(row)">
					权限
				</el-button>
				<el-button
v-if="!row.isSystem" v-auth="'role:delete'" link type="danger" size="small"
					:loading="deletingId === row.id" @click="handleDelete(row)">
					删除
				</el-button>
			</template>
		</DataTable>

		<!-- ── 新建/编辑角色弹窗 ── -->
		<Modal
v-model="roleDialogVisible" :title="isEditing ? '编辑角色' : '新增角色'" :confirm-loading="saving"
			@confirm="handleSaveRole" @close="resetRoleForm">
			<el-form ref="roleFormRef" :model="roleForm" :rules="roleRules" label-width="80px">
				<el-form-item label="角色标识" prop="code">
					<el-input v-model="roleForm.code" :disabled="isEditing" placeholder="如 editor、reviewer（仅小写字母/数字/下划线）" />
				</el-form-item>
				<el-form-item label="角色名称" prop="name">
					<el-input v-model="roleForm.name" placeholder="如 编辑者、审核员" />
				</el-form-item>
				<el-form-item label="描述" prop="description">
					<el-input v-model="roleForm.description" type="textarea" :rows="2" placeholder="可选" />
				</el-form-item>
				<el-form-item label="状态" prop="status">
					<el-switch
v-model="roleForm.status" :active-value="1" :inactive-value="0" active-text="启用"
						inactive-text="停用" />
				</el-form-item>
			</el-form>
		</Modal>

		<!-- ── 权限分配弹窗 ── -->
		<Modal
v-model="permDialogVisible" title="分配权限" width="680px" :confirm-loading="savingPerms"
			@confirm="handleSavePermissions">
			<div v-if="currentRole" class="perm-dialog-header">
				<span>角色：<strong>{{ currentRole.name }}</strong>（{{ currentRole.code }}）</span>
			</div>
			<el-scrollbar max-height="420px">
				<div v-loading="loadingPerms" class="perm-groups">
					<div v-for="group in permissionGroups" :key="group.module" class="perm-group">
						<div class="perm-group-header">
							<el-checkbox
:model-value="isModuleAllChecked(group)" :indeterminate="isModuleIndeterminate(group)"
								@change="toggleModule(group, $event as boolean)">
								<strong>{{ moduleLabels[group.module] || group.module }}</strong>
							</el-checkbox>
						</div>
						<div class="perm-group-body">
							<el-checkbox
v-for="perm in group.permissions" :key="perm.id"
								:model-value="selectedPermIds.includes(perm.id)" @change="togglePerm(perm.id, $event as boolean)">
								{{ perm.name }}
								<span v-if="perm.description" class="perm-desc">{{ perm.description }}</span>
							</el-checkbox>
						</div>
					</div>
				</div>
			</el-scrollbar>
		</Modal>
	</div>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { Permission, PermissionGroup, RoleListItem } from '~/types/rbac'
import {
	apiGetRoles, apiCreateRole, apiUpdateRole, apiDeleteRole,
	apiGetPermissions, apiGetRole, apiSetRolePermissions,
} from '~/api/rbac'

// ── 表格列定义 ──
const columns = [
	{ prop: 'name', label: '角色名称', minWidth: 120 },
	{ prop: 'code', label: '角色标识', minWidth: 120 },
	{ prop: 'isSystem', label: '类型', width: 80, slot: 'isSystem', align: 'center' },
	{ prop: 'status', label: '状态', width: 80, slot: 'status', align: 'center' },
	{ prop: 'permissionCount', label: '权限数', width: 90, slot: 'permissionCount', align: 'center' },
	{ prop: 'userCount', label: '用户数', width: 80, align: 'center' },
	{ prop: 'createdAt', label: '创建时间', width: 170, dateFormat: 'datetime' },
]

// ── 数据状态 ──
const loading = ref(false)
const roleList = ref<RoleListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')

const deletingId = ref<number | null>(null)

// ── 新建/编辑 ──
const roleDialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const roleFormRef = ref<FormInstance>()
const roleForm = reactive({
	code: '',
	name: '',
	description: '',
	status: 1 as 0 | 1,
})
const roleRules: FormRules = {
	code: [
		{ required: true, message: '请输入角色标识', trigger: 'blur' },
		{ pattern: /^[a-z][a-z0-9_]{1,48}$/, message: '仅小写字母/数字/下划线，2-49位', trigger: 'blur' }
	],
	name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }]
}

// ── 权限分配 ──
const permDialogVisible = ref(false)
const currentRole = ref<RoleListItem | null>(null)
const loadingPerms = ref(false)
const savingPerms = ref(false)
const allPermissions = ref<Permission[]>([])
const selectedPermIds = ref<number[]>([])

const moduleLabels: Record<string, string> = {
	user: '用户管理',
	role: '角色管理',
	permission: '权限管理',
	doc: '文档管理',
	approval: '审批管理',
	log: '日志管理',
	notification: '通知管理',
	system: '系统配置'
}

const permissionGroups = computed<PermissionGroup[]>(() => {
	const map = new Map<string, Permission[]>()
	for (const p of allPermissions.value) {
		if (!map.has(p.module)) map.set(p.module, [])
		map.get(p.module)!.push(p)
	}
	return Array.from(map.entries()).map(([module, permissions]) => ({ module, permissions }))
})

// ── 加载角色列表 ──
async function loadRoles() {
	loading.value = true
	try {
		const res = await apiGetRoles({
			page: page.value,
			pageSize: pageSize.value,
			keyword: keyword.value,
		})

		if (res.success && res.data) {
			roleList.value = res.data.list
			total.value = res.data.total
		}
	} catch {
		msgError('加载角色列表失败')
	} finally {
		loading.value = false
	}
}

function onSearch(kw: string) {
	keyword.value = kw
	if (page.value !== 1) {
		page.value = 1
	} else {
		loadRoles()
	}
}

// 分页变更——跳过 hydration 阶段的虚假触发
let _mounted = false
watch([() => page.value, () => pageSize.value], () => {
	if (_mounted) loadRoles()
})

onMounted(() => {
	_mounted = true
	loadRoles()
})

// ── 新建 ──
function openCreateDialog() {
	isEditing.value = false
	editingId.value = null
	roleForm.code = ''
	roleForm.name = ''
	roleForm.description = ''
	roleForm.status = 1
	roleDialogVisible.value = true
}

// ── 编辑 ──
function openEditDialog(row: RoleListItem) {
	isEditing.value = true
	editingId.value = row.id
	roleForm.code = row.code
	roleForm.name = row.name
	roleForm.description = row.description || ''
	roleForm.status = row.status
	roleDialogVisible.value = true
}

function resetRoleForm() {
	roleFormRef.value?.resetFields()
}

// ── 保存角色 ──
async function handleSaveRole() {
	if (!roleFormRef.value) return
	const valid = await roleFormRef.value.validate().catch(() => false)
	if (!valid) return

	saving.value = true
	try {
		if (isEditing.value && editingId.value) {
			const res = await apiUpdateRole(editingId.value, {
				name: roleForm.name,
				description: roleForm.description,
				status: roleForm.status,
			})
			if (res.success) {
				msgSuccess(res.message || '角色更新成功')
				roleDialogVisible.value = false
				loadRoles()
			} else {
				msgError(res.message || '更新失败')
			}
		} else {
			const res = await apiCreateRole(roleForm)
			if (res.success) {
				msgSuccess(res.message || '角色创建成功')
				roleDialogVisible.value = false
				loadRoles()
			} else {
				msgError(res.message || '创建失败')
			}
		}
	} catch {
		msgError('操作失败')
	} finally {
		saving.value = false
	}
}

// ── 删除角色 ──
async function handleDelete(row: RoleListItem) {
	const confirmed = await msgConfirm(
		`确定删除角色「${row.name}」？关联的用户将失去该角色的权限。`,
		'删除确认',
		{ confirmText: '删除', danger: true },
	)
	if (!confirmed) return

	deletingId.value = row.id
	try {
		const res = await apiDeleteRole(row.id)
		if (res.success) {
			msgSuccess(res.message || '角色已删除')
			loadRoles()
		} else {
			msgError(res.message || '删除失败')
		}
	} catch {
		msgError('删除失败')
	} finally {
		deletingId.value = null
	}
}

// ── 权限分配 ──
async function openPermissionDialog(row: RoleListItem) {
	currentRole.value = row
	permDialogVisible.value = true
	loadingPerms.value = true

	try {
		// 并行加载全部权限 + 角色已有权限
		const [allRes, roleRes] = await Promise.all([
			apiGetPermissions(),
			apiGetRole(row.id),
		])

		if (allRes.success && allRes.data) {
			allPermissions.value = allRes.data
		}
		if (roleRes.success && roleRes.data) {
			selectedPermIds.value = roleRes.data.permissions?.map(p => p.id) || []
		}
	} catch {
		msgError('加载权限数据失败')
	} finally {
		loadingPerms.value = false
	}
}

function isModuleAllChecked(group: PermissionGroup): boolean {
	return group.permissions.every(p => selectedPermIds.value.includes(p.id))
}

function isModuleIndeterminate(group: PermissionGroup): boolean {
	const checked = group.permissions.filter(p => selectedPermIds.value.includes(p.id)).length
	return checked > 0 && checked < group.permissions.length
}

function toggleModule(group: PermissionGroup, checked: boolean) {
	const ids = group.permissions.map(p => p.id)
	if (checked) {
		selectedPermIds.value = [...new Set([...selectedPermIds.value, ...ids])]
	} else {
		selectedPermIds.value = selectedPermIds.value.filter(id => !ids.includes(id))
	}
}

function togglePerm(id: number, checked: boolean) {
	if (checked) {
		if (!selectedPermIds.value.includes(id)) {
			selectedPermIds.value.push(id)
		}
	} else {
		selectedPermIds.value = selectedPermIds.value.filter(i => i !== id)
	}
}

async function handleSavePermissions() {
	if (!currentRole.value) return

	savingPerms.value = true
	try {
		const res = await apiSetRolePermissions(currentRole.value.id, selectedPermIds.value)
		if (res.success) {
			msgSuccess(res.message || '权限分配成功')
			permDialogVisible.value = false
			loadRoles()
		} else {
			msgError(res.message || '分配失败')
		}
	} catch {
		msgError('权限保存失败')
	} finally {
		savingPerms.value = false
	}
}

// ── 暴露给父组件 ──
defineExpose({ refresh: loadRoles, loading })
</script>

<style lang="scss" scoped>
.perm-dialog-header {
	margin-bottom: 16px;
	padding-bottom: 12px;
	border-bottom: 1px solid var(--df-border);
	font-size: 13px;
	color: var(--df-subtext);
}

.perm-groups {
	padding-right: 8px;
}

.perm-group {
	margin-bottom: 16px;

	&-header {
		margin-bottom: 8px;
	}

	&-body {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		padding-left: 24px;
	}
}

.perm-desc {
	color: var(--df-subtext);
	font-size: 12px;
	margin-left: 4px;
}

.mr-1 {
	margin-right: 4px;
}
</style>
