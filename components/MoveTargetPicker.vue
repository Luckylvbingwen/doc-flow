<template>
	<Modal
v-model="visible" title="跨组移动" width="520px" :confirm-loading="loading" confirm-text="确认移动"
		:confirm-disabled="!selectedGroupId || !acknowledged" @confirm="onConfirm" @cancel="visible = false">
		<div class="df-move-picker">
			<p class="df-move-picker__hint">
				选择目标组，文件将移动到该组中。移动后权限将依赖目标组的成员权限。
			</p>
			<el-input v-model="searchKeyword" placeholder="搜索组名..." clearable class="df-move-picker__search" />
			<DocNavTree v-model="selectedGroupId" :categories="filteredTree" mode="picker" :exclude-id="excludeGroupId" />
			<el-alert v-if="selectedGroupId" type="warning" :closable="false" show-icon title="移动后，目标组负责人将收到通知，文档权限将跟随目标组" />
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
const searchKeyword = ref('')

/** 根据关键字过滤组树 */
const filteredTree = computed(() => {
	const kw = searchKeyword.value.trim().toLowerCase()
	if (!kw) return treeData.value
	return treeData.value.map(cat => ({
		...cat,
		groups: filterGroups(cat.groups ?? [], kw),
	})).filter(cat => (cat.groups?.length ?? 0) > 0)
})

function filterGroups(groups: NavTreeCategory['groups'] & any[], kw: string): any[] {
	const result: any[] = []
	for (const g of groups) {
		const childMatches = g.children?.length ? filterGroups(g.children, kw) : []
		if (g.name.toLowerCase().includes(kw) || childMatches.length > 0) {
			result.push({ ...g, children: childMatches.length > 0 ? childMatches : g.children })
		}
	}
	return result
}

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
