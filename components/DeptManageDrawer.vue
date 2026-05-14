<template>
	<el-drawer
:model-value="visible" :title="`${deptName} — 部门管理`" size="640px" :close-on-click-modal="false"
		class="df-detail-drawer" @close="close">
		<div class="plm-body">
			<el-tabs v-model="activeTab">
				<el-tab-pane label="基本信息" name="info">
					<DeptInfoTab :dept-id="deptId" :dept-name="deptName" />
				</el-tab-pane>
				<el-tab-pane :label="`管理员 (${adminCount})`" name="admins">
					<DeptAdminTab :dept-id="deptId" @count-change="adminCount = $event" />
				</el-tab-pane>
				<el-tab-pane :label="`下属组 (${groupCount})`" name="groups">
					<DeptGroupListTab :dept-id="deptId" @count-change="groupCount = $event" @navigate-group="onNavigateGroup" />
				</el-tab-pane>
			</el-tabs>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
const props = defineProps<{
	visible: boolean
	deptId: number
	deptName: string
}>()

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'navigate-group': [groupId: number]
}>()

const activeTab = ref('info')
const adminCount = ref(0)
const groupCount = ref(0)

function close() {
	emit('update:visible', false)
}

function onNavigateGroup(groupId: number) {
	close()
	emit('navigate-group', groupId)
}

watch(() => props.visible, (val) => {
	if (val) activeTab.value = 'info'
})
</script>
