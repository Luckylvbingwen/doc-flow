<template>
	<div class="pla-tab">
		<div class="pla-toolbar">
			<span class="pla-toolbar__title">部门管理员</span>
			<span class="pla-toolbar__count">共 {{ adminList.length }} 人</span>
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
				<span class="pla-item__time">添加时间: {{ formatTime(item.createdAt, 'YYYY-MM-DD') }}</span>
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

		<div class="pla-hint">
			管理员和负责人可以创建部门下的组，管理本部门信息和成员。一个部门可以有多个管理员。
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
import { formatTime } from '~/utils/format'

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

<style lang="scss" scoped>
.pla-tab {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.pla-toolbar {
	display: flex;
	align-items: center;
	gap: 12px;

	&__title {
		font-size: 14px;
		font-weight: 600;
		color: var(--df-text);
	}

	&__count {
		flex: 1;
		font-size: 12px;
		color: var(--df-subtext);
	}
}

.pla-list {
	min-height: 80px;
}

.pla-item {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 0;
	border-bottom: 1px solid var(--df-border);

	&:last-child {
		border-bottom: none;
	}

	&__avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--df-primary-soft);
		color: var(--df-primary);
		font-size: 13px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	&__info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	&__name {
		font-size: 13px;
		font-weight: 500;
		color: var(--df-text);
	}

	&__email {
		font-size: 11px;
		color: var(--df-subtext);
	}

	&__time {
		font-size: 11px;
		color: var(--df-subtext);
		flex-shrink: 0;
	}

	&__badge {
		flex-shrink: 0;
	}
}

.pla-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 40px 0;
	color: var(--df-subtext);
	font-size: 13px;
}

.pla-hint {
	margin-top: 4px;
	padding: 10px 14px;
	background: var(--df-primary-soft);
	border-radius: 6px;
	font-size: 12px;
	color: var(--df-primary);
}
</style>
