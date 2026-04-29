<template>
	<el-drawer
:model-value="visible" title="公司层 — 管理员设置" size="520px" :close-on-click-modal="false"
		class="df-detail-drawer" @close="close">
		<div class="ca-body">
			<!-- 说明提示 -->
			<el-alert type="info" :closable="false" show-icon class="ca-tip">
				<template #title>
					公司层管理员可在公司层下创建组。仅系统管理员可添加或移除公司层管理员。
				</template>
			</el-alert>

			<!-- 操作栏 -->
			<div class="ca-toolbar">
				<span class="ca-toolbar__title">管理员列表</span>
				<el-button v-if="canManage" type="primary" size="small" @click="selectorVisible = true">
					<el-icon :size="13">
						<Plus />
					</el-icon>
					添加管理员
				</el-button>
			</div>

			<!-- 列表 -->
			<div v-loading="loading" class="ca-list">
				<div v-for="item in adminList" :key="item.id" class="ca-item">
					<div class="ca-item__avatar">{{ item.name?.slice(0, 1) }}</div>
					<div class="ca-item__info">
						<span class="ca-item__name">{{ item.name }}</span>
						<span v-if="item.email" class="ca-item__email">{{ item.email }}</span>
					</div>
					<span class="ca-item__time">{{ formatTime(item.createdAt) }}</span>
					<el-button
v-if="canManage && !isSuperAdmin(item)" type="danger" text size="small"
						:loading="removingId === item.id" @click="handleRemove(item)">
						移除
					</el-button>
					<el-tag v-if="isSuperAdmin(item)" size="small" type="warning" class="ca-item__badge">
						系统管理员
					</el-tag>
				</div>
				<div v-if="!loading && adminList.length === 0" class="ca-empty">
					<el-icon :size="36" color="var(--df-subtext)" style="opacity: 0.3">
						<User />
					</el-icon>
					<p>暂无公司层管理员</p>
				</div>
			</div>
		</div>

		<!-- 成员选择器 -->
		<MemberSelectorModal
v-model:visible="selectorVisible" :exclude-user-ids="excludeUserIds"
			:show-role-selector="false" @confirm="handleAddConfirm" />
	</el-drawer>
</template>

<script setup lang="ts">
import { Plus, User } from '@element-plus/icons-vue'
import type { AdminUserItem } from '~/types/admin'
import { apiGetAdminUsers, apiPutAdminUserRoles } from '~/api/admin'
import type { SelectedUser } from '~/types/group-member'
import { formatTime } from '~/utils/format'

const props = defineProps<{
	visible: boolean
}>()

const emit = defineEmits<{
	'update:visible': [value: boolean]
}>()

const { hasRole } = useAuth()

const loading = ref(false)
const removingId = ref<number | null>(null)
const selectorVisible = ref(false)
const adminList = ref<AdminUserItem[]>([])

/** 仅 super_admin 可添加/移除 */
const canManage = computed(() => hasRole('super_admin'))

/** 排除已经是管理员的用户 */
const excludeUserIds = computed(() => adminList.value.map(u => u.id))

function isSuperAdmin(user: AdminUserItem) {
	return user.roles.some(r => r.code === 'super_admin')
}

function close() {
	emit('update:visible', false)
}

async function loadAdmins() {
	loading.value = true
	try {
		const res = await apiGetAdminUsers({ roles: 'company_admin,super_admin', pageSize: 100 })
		if (res.success && res.data) {
			adminList.value = res.data.list
		}
	} finally {
		loading.value = false
	}
}

/** 添加管理员 — 选择后逐个调用 roles PUT，保留原有 plHead 状态 */
async function handleAddConfirm(users: SelectedUser[]) {
	if (!users.length) return

	// 批量查询选中用户的当前角色（用于保留 plHead 状态）
	const ids = users.map(u => u.id)
	const queryRes = await apiGetAdminUsers({ pageSize: 100 })
	const userRoleMap = new Map<number, boolean>()
	if (queryRes.success && queryRes.data) {
		for (const u of queryRes.data.list) {
			if (ids.includes(u.id)) {
				userRoleMap.set(u.id, u.roles.some(r => r.code === 'pl_head'))
			}
		}
	}

	let successCount = 0
	for (const user of users) {
		try {
			const keepPlHead = userRoleMap.get(user.id) ?? false
			const res = await apiPutAdminUserRoles(user.id, { companyAdmin: true, plHead: keepPlHead })
			if (res.success) successCount++
		} catch {
			// 单个失败不中断
		}
	}

	if (successCount > 0) {
		msgSuccess(`已添加 ${successCount} 位管理员`)
		await loadAdmins()
	} else {
		msgError('添加失败，请重试')
	}
}

/** 移除管理员 */
async function handleRemove(user: AdminUserItem) {
	const confirmed = await msgConfirm(`确定移除 ${user.name} 的公司层管理员权限？`, '操作确认', { type: 'warning' })
	if (!confirmed) return

	removingId.value = user.id
	try {
		// 保留用户当前的 plHead 状态
		const keepPlHead = user.roles.some(r => r.code === 'pl_head')
		const res = await apiPutAdminUserRoles(user.id, { companyAdmin: false, plHead: keepPlHead })
		if (res.success) {
			msgSuccess(res.message || '已移除管理员')
			await loadAdmins()
		}
	} finally {
		removingId.value = null
	}
}

watch(() => props.visible, (val) => {
	if (val) loadAdmins()
})
</script>
