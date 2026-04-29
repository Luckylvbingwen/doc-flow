<template>
	<div class="pla-tab">
		<div class="pla-toolbar">
			<span class="pla-toolbar__title">产品线管理员</span>
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
					产品线负责人
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
import { apiGetPLAdmins, apiAddPLAdmin, apiRemovePLAdmin } from '~/api/product-lines'
import type { PLAdminItem } from '~/api/product-lines'
import type { SelectedUser } from '~/types/group-member'

const props = defineProps<{
	plId: number
}>()

const emit = defineEmits<{
	'count-change': [count: number]
}>()

const { hasRole } = useAuth()
const canManage = computed(() => hasRole(['super_admin', 'pl_head']))

const loading = ref(false)
const removingId = ref<number | null>(null)
const selectorVisible = ref(false)
const adminList = ref<PLAdminItem[]>([])

const excludeUserIds = computed(() => adminList.value.map(a => a.userId))

async function loadAdmins() {
	loading.value = true
	try {
		const res = await apiGetPLAdmins(props.plId)
		if (res.success && res.data) {
			adminList.value = res.data
			emit('count-change', res.data.length)
		}
	} finally {
		loading.value = false
	}
}

async function handleAddConfirm(users: SelectedUser[]) {
	if (!users.length) return

	let successCount = 0
	for (const user of users) {
		try {
			const res = await apiAddPLAdmin(props.plId, user.id)
			if (res.success) successCount++
		} catch {
			// 单个失败不中断
		}
	}

	if (successCount > 0) {
		msgSuccess(`已添加 ${successCount} 位产品线管理员`)
		await loadAdmins()
	} else {
		msgError('添加失败，请重试')
	}
}

async function handleRemove(item: PLAdminItem) {
	const confirmed = await msgConfirm(`确定移除 ${item.name} 的管理员权限？`, '操作确认', { type: 'warning' })
	if (!confirmed) return

	removingId.value = item.userId
	try {
		const res = await apiRemovePLAdmin(props.plId, item.userId)
		if (res.success) {
			msgSuccess(res.message || '已移除')
			await loadAdmins()
		} else {
			msgError(res.message || '移除失败')
		}
	} finally {
		removingId.value = null
	}
}

watch(() => props.plId, () => { if (props.plId) loadAdmins() }, { immediate: true })
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
	justify-content: space-between;

	&__title {
		font-size: 14px;
		font-weight: 600;
		color: var(--df-text);
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
		width: 32px;
		height: 32px;
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
		font-size: 14px;
		font-weight: 500;
		color: var(--df-text);
	}

	&__email {
		font-size: 12px;
		color: var(--df-subtext);
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
</style>
