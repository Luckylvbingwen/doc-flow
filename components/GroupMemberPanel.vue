<template>
	<div class="gm-panel">
		<div class="gm-panel__header">
			<span class="gm-panel__count">共 {{ members.length }} 人</span>
			<el-button type="primary" size="small" @click="$emit('invite')">
				<el-icon :size="14">
					<Plus />
				</el-icon>
				邀请成员
			</el-button>
		</div>

		<el-table v-loading="loading" :data="members" class="df-data-table" style="width: 100%">
			<el-table-column label="成员" min-width="180">
				<template #default="{ row }">
					<div class="gm-panel__user">
						<img
v-if="row.avatar" class="gm-panel__avatar" :src="row.avatar"
							@error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'">
						<span v-else class="gm-panel__avatar gm-panel__avatar--text">{{ row.name?.slice(0, 1) }}</span>
						<span>{{ row.name }}</span>
					</div>
				</template>
			</el-table-column>

			<el-table-column label="邮箱" prop="email" min-width="200" show-overflow-tooltip />

			<el-table-column label="权限" width="150">
				<template #default="{ row }">
					<el-select
:model-value="row.role" :disabled="row.immutableFlag === 1" size="small"
						@change="(val: number) => onRoleChange(row, val)">
						<el-option :value="1" label="管理员" />
						<el-option :value="2" label="可编辑" />
						<el-option :value="3" label="上传下载" />
					</el-select>
				</template>
			</el-table-column>

			<el-table-column label="来源" width="140">
				<template #default="{ row }">
					<el-tag v-if="row.immutableFlag === 1" type="danger" size="small" effect="plain" round>
						组负责人
					</el-tag>
					<el-tag v-else-if="row.sourceType === 2" size="small" effect="plain" round>
						飞书同步
					</el-tag>
					<el-tag v-else type="info" size="small" effect="plain" round>
						手动添加
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column label="操作" width="80" align="center">
				<template #default="{ row }">
					<el-button
v-if="row.immutableFlag !== 1" type="danger" text size="small" :loading="removingId === row.id"
						@click="onRemove(row)">
						移除
					</el-button>
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { GroupMember } from '~/types/group-member'
import { apiGetGroupMembers, apiUpdateMemberRole, apiRemoveMember } from '~/api/group-members'

const props = defineProps<{
	groupId: number
}>()

defineEmits<{
	invite: []
}>()

const loading = ref(false)
const members = ref<GroupMember[]>([])
const removingId = ref<number | null>(null)

async function loadMembers() {
	loading.value = true
	try {
		const res = await apiGetGroupMembers(props.groupId)
		if (res.success) {
			members.value = res.data
		}
	} finally {
		loading.value = false
	}
}

async function onRoleChange(member: GroupMember, newRole: number) {
	const res = await apiUpdateMemberRole(props.groupId, member.id, { role: newRole as 1 | 2 | 3 })
	if (res.success) {
		msgSuccess(res.message || '权限已更新')
		member.role = newRole as 1 | 2 | 3
	} else {
		msgError(res.message || '操作失败')
		await loadMembers()
	}
}

async function onRemove(member: GroupMember) {
	const confirmed = await msgConfirm(
		`确定移除成员「${member.name}」吗？移除后该成员将无法访问此组的文件。`,
		'移除成员',
	)
	if (!confirmed) return

	removingId.value = member.id
	try {
		const res = await apiRemoveMember(props.groupId, member.id)
		if (res.success) {
			msgSuccess(res.message || '成员已移除')
			members.value = members.value.filter(m => m.id !== member.id)
		} else {
			msgError(res.message || '操作失败')
		}
	} finally {
		removingId.value = null
	}
}

function refresh() {
	loadMembers()
}

defineExpose({ refresh })

watch(() => props.groupId, () => loadMembers(), { immediate: true })
</script>
