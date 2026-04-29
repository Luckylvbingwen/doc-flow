<template>
	<el-drawer
:model-value="visible" :title="`${plName} — 产品线管理`" size="640px" :close-on-click-modal="false"
		class="df-detail-drawer" @close="close">
		<div class="plm-body">
			<el-tabs v-model="activeTab">
				<el-tab-pane label="基本信息" name="info">
					<PLInfoTab :pl-id="plId" :pl-name="plName" @updated="emit('success')" />
				</el-tab-pane>
				<el-tab-pane :label="`管理员 (${adminCount})`" name="admins">
					<PLAdminTab :pl-id="plId" @count-change="adminCount = $event" />
				</el-tab-pane>
				<el-tab-pane :label="`项目组列表 (${groupCount})`" name="groups">
					<PLGroupListTab :pl-id="plId" @count-change="groupCount = $event" @navigate-group="onNavigateGroup" />
				</el-tab-pane>
			</el-tabs>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
const props = defineProps<{
	visible: boolean
	plId: number
	plName: string
}>()

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'success': []
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

<style lang="scss" scoped>
.plm-body {
	:deep(.el-tabs__header) {
		margin-bottom: 20px;
	}
}
</style>
