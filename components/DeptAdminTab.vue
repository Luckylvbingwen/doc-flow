<template>
	<div class="pla-tab">
		<div class="pla-toolbar">
			<span class="pla-toolbar__title">部门管理员</span>
			<el-button v-if="canManage" type="primary" size="small" @click="selectorVisible = true">
				<el-icon :size="13">
					<Plus />
				</el-icon>
				添加管理员
			</el-button>
		</div>

		<div v-loading="loading" class="pla-list">
			<div v-for="item in adminList" :key="item.userId" class="pla-item">
				<div class="pla-item__avatar">{{ item.name?.slice(0, 1) }}</div>
				<div class="pla-item__info">
					<span class="pla-item__name">{{ item.name }}</span>
					<span v-if="item.email" class="pla-item__email">{{ item.email }}</span>
				</div>
				<el-tag v-if="item.isOwner" size="small" type="danger" class="pla-item__badge">
					部门负责人
				</el-tag>
				<el-tag v-else size="small" class="pla-item__badge">
					管理员
				</el-tag>
				<el-button
v-if="canManage && !item.isOwner" type="danger" text size="small"
					:loading="removingId === item.userId" @click="handleRemove(item)">
					移除
				</el-button>
			</div>
			<div v-if="!loading && adminList.length === 0" class="pla-empty">
				<el-icon :size="36" color="var(--df-subtext)" style="opacity: 0.3">
					<User />
				</el-icon>
				<p>暂无管理员</p>
			</div>
		</div>

		<MemberSelectorModal
v-model:visible="selectorVisible" :exclude-user-ids="excludeUserIds"
			:show-role-selector="false" @confirm="handleAddConfirm" />
	</div>
</template>

<script setup lang="ts">
import { Plus, User } from '@element-plus/icons-vue'
import { apiGetDeptAdmins, apiAddDeptAdmin, apiRemoveDeptAdmin } from '~/api/departments'
import type { DeptAdminItem } from '~/api/departments'
import type { SelectedUser } from '~/types/group-member'

const props = defineProps<{
	deptId: number
}>()

const emit = defineEmits<{
	'count-change': [count: number]
}>()

const { hasRole } = useAuth()
const { msgSuccess, msgError, msgConfirm } = useNotify()
const canManage = computed(() => hasRole(['super_admin']))

const loading = ref(false)
const adminList = ref<DeptAdminItem[]>([])
const removingId = ref<number | null>(null)
const selectorVisible = ref(false)

const excludeUserIds = computed(() => adminList.value.map(a => a.userId))

async function loadAdmins() {
	loading.value = true
	try {
		const res = await apiGetDeptAdmins(props.deptId)
		if (res.success && res.data) {
			adminList.value = res.data
			emit('count-change', res.data.length)
		}
	} finally {
		loading.value = false
	}
}

async function handleAddConfirm(users: SelectedUser[]) {
	for (const u of users) {
		try {
			const res = await apiAddDeptAdmin(props.deptId, u.id)
			if (res.success) msgSuccess(res.message || `已添加 ${u.name}`)
			else msgError(res.message || '添加失败')
		} catch {
			msgError(`添加 ${u.name} 失败`)
		}
	}
	selectorVisible.value = false
	await loadAdmins()
}

async function handleRemove(item: DeptAdminItem) {
	const confirmed = await msgConfirm(`确定移除管理员「${item.name}」？`, '移除管理员', { danger: true })
	if (!confirmed) return

	removingId.value = item.userId
	try {
		const res = await apiRemoveDeptAdmin(props.deptId, item.userId)
		if (res.success) {
			msgSuccess(res.message || '移除成功')
			await loadAdmins()
		} else {
			msgError(res.message || '移除失败')
		}
	} catch {
		msgError('移除失败')
	} finally {
		removingId.value = null
	}
}

watch(() => props.deptId, () => loadAdmins(), { immediate: true })
</script>
