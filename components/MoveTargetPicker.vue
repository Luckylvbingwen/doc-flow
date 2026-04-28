<template>
	<Modal
v-model="visible" title="跨组移动" width="520px" :confirm-loading="loading" confirm-text="确认移动"
		:confirm-disabled="!selectedGroupId || !acknowledged" @confirm="onConfirm" @cancel="visible = false">
		<div class="df-move-picker">
			<p class="df-move-picker__hint">
				选择目标组，文件将移动到该组中。移动后权限将依赖目标组的成员权限。
			</p>
			<DocNavTree v-model="selectedGroupId" :categories="treeData" mode="picker" :exclude-id="excludeGroupId" />
			<div class="df-move-picker__ack">
				<el-checkbox v-model="acknowledged">
					我已知悉移动后文件权限将跟随目标组
				</el-checkbox>
			</div>
		</div>
	</Modal>
</template>

<script setup lang="ts">
import { apiGetGroupTree } from '~/api/groups'
import type { NavTreeCategory } from '~/types/doc-nav-tree'

defineProps<{
	/** 文档 ID（单文件移动） */
	documentId: number
	/** 当前所属组 ID（排除） */
	excludeGroupId: number
}>()

const emit = defineEmits<{
	confirm: [targetGroupId: number]
}>()

const visible = defineModel<boolean>({ default: false })
const loading = defineModel<boolean>('loading', { default: false })

const treeData = ref<NavTreeCategory[]>([])
const selectedGroupId = ref<number | null>(null)
const acknowledged = ref(false)

watch(visible, async (val) => {
	if (val) {
		selectedGroupId.value = null
		acknowledged.value = false
		if (treeData.value.length === 0) {
			const res = await apiGetGroupTree()
			if (res.success) treeData.value = res.data
		}
	}
})

function onConfirm() {
	if (!selectedGroupId.value) return
	emit('confirm', selectedGroupId.value)
}
</script>

<style scoped>
.df-move-picker {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.df-move-picker__hint {
	font-size: 13px;
	color: var(--df-subtext);
	margin: 0;
}

.df-move-picker :deep(.dn-tree) {
	border: 1px solid var(--df-border);
	border-radius: 8px;
	max-height: 360px;
}

.df-move-picker__ack {
	padding-top: 4px;
}
</style>
