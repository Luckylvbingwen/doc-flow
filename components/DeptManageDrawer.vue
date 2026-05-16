<template>
	<el-drawer :model-value="visible" :title="`${deptName} — 部门管理`" size="840px" class="df-detail-drawer" @close="close">
		<div class="plm-body">
			<el-tabs v-model="activeTab">
				<el-tab-pane label="基本信息" name="info">
					<DeptInfoTab :dept-id="deptId" :dept-name="deptName" @deleted="onDeptDeleted" />
				</el-tab-pane>
				<el-tab-pane :label="`管理员 (${adminCount})`" name="admins">
					<DeptAdminTab :dept-id="deptId" @count-change="adminCount = $event" />
				</el-tab-pane>
				<el-tab-pane :label="`下属组 (${groupCount})`" name="groups">
					<DeptGroupListTab
ref="groupListRef" :dept-id="deptId" @count-change="groupCount = $event"
						@navigate-group="onNavigateGroup" @create-group="onCreateGroup" @delete-group="onDeleteGroup" />
				</el-tab-pane>
			</el-tabs>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import type { DeptGroupItem } from '~/api/departments'

const props = defineProps<{
	visible: boolean
	deptId: number
	deptName: string
}>()

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'navigate-group': [groupId: number]
	'create-group': [deptId: number, deptName: string]
	'delete-group': [group: DeptGroupItem]
	'dept-deleted': []
}>()

const activeTab = ref('info')
const adminCount = ref(0)
const groupCount = ref(0)
const groupListRef = ref<{ refresh: () => void } | null>(null)

function close() {
	emit('update:visible', false)
}

function onNavigateGroup(groupId: number) {
	close()
	emit('navigate-group', groupId)
}

function onCreateGroup() {
	emit('create-group', props.deptId, props.deptName)
}

function onDeleteGroup(group: DeptGroupItem) {
	emit('delete-group', group)
}

function onDeptDeleted() {
	close()
	emit('dept-deleted')
}

watch(() => props.visible, (val) => {
	if (val) activeTab.value = 'info'
})

defineExpose({
	refreshGroups: () => groupListRef.value?.refresh(),
})
</script>
