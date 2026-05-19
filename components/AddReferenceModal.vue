<template>
	<Modal
v-model="visibleLocal" title="添加引用" width="760px" :confirm-loading="confirmLoading" confirm-text="确认引用"
		@confirm="handleConfirm">
		<div class="arm-toolbar">
			<el-select v-model="sourceGroupId" placeholder="所有可见组" clearable style="width: 200px" @change="reload">
				<el-option v-for="g in groupOptions" :key="g.id" :label="`${g.name}（${g.fileCount ?? 0}个文件）`" :value="g.id" />
			</el-select>
			<el-input
v-model="keyword" placeholder="搜索文件名..." clearable style="flex:1" @keyup.enter="reload"
				@clear="reload" />
			<div class="arm-count">已选择 {{ selectedIds.length }} 个文档</div>
		</div>

		<el-scrollbar max-height="420px">
			<div v-loading="loading" class="arm-list">
				<div v-for="item in list" :key="item.id" class="arm-item">
					<el-checkbox
:model-value="selectedIds.includes(item.id)" :disabled="item.isReferenced"
						@change="toggle(item.id)" />
					<div class="arm-item__main">
						<div class="arm-item__title">{{ item.title }}</div>
						<div class="arm-item__meta">
							{{ item.groupName }} · {{ item.versionNo }} · {{ item.ownerName }} · {{ formatTime(item.updatedAt,
								'YYYY-MM-DD') }}
						</div>
					</div>
					<el-tag v-if="item.isReferenced" type="warning" size="small">已引用</el-tag>
				</div>
				<EmptyState v-if="!loading && list.length === 0" preset="no-results" title="暂无可引用文档" compact />
			</div>
		</el-scrollbar>
	</Modal>
</template>

<script setup lang="ts">
import { apiSearchReferences, apiAddReferences, type ReferenceSearchItem } from '~/api/document-references'
import { apiGetGroupTree } from '~/api/groups'
import type { NavTreeGroup } from '~/types/doc-nav-tree'
import { formatTime } from '~/utils/format'

const props = defineProps<{
	modelValue: boolean
	groupId: number
}>()

const emit = defineEmits<{
	'update:modelValue': [value: boolean]
	'success': []
}>()

const visibleLocal = computed({
	get: () => props.modelValue,
	set: (v: boolean) => emit('update:modelValue', v),
})

const loading = ref(false)
const confirmLoading = ref(false)
const keyword = ref('')
const sourceGroupId = ref<number | undefined>(undefined)
const list = ref<ReferenceSearchItem[]>([])
const selectedIds = ref<number[]>([])
const groupOptions = ref<{ id: number; name: string; fileCount?: number }[]>([])

/** 从组树扁平化所有组（排除当前组） */
function flattenGroups(nodes: NavTreeGroup[]): { id: number; name: string; fileCount?: number }[] {
	const result: { id: number; name: string; fileCount?: number }[] = []
	for (const n of nodes) {
		if (n.id !== props.groupId) {
			result.push({ id: n.id, name: n.name, fileCount: n.fileCount })
		}
		if (n.children?.length) {
			result.push(...flattenGroups(n.children))
		}
	}
	return result
}

async function loadGroupOptions() {
	const res = await apiGetGroupTree()
	if (res.success) {
		const allGroups: NavTreeGroup[] = []
		for (const cat of res.data) {
			if (cat.groups) allGroups.push(...cat.groups)
		}
		groupOptions.value = flattenGroups(allGroups)
	}
}

async function reload() {
	loading.value = true
	try {
		const res = await apiSearchReferences(props.groupId, {
			keyword: keyword.value || undefined,
			sourceGroupId: sourceGroupId.value,
			page: 1,
			pageSize: 100,
		})
		if (res.success) {
			list.value = res.data.list
		} else {
			msgError(res.message || '加载可引用文档失败')
		}
	} catch {
		msgError('加载可引用文档失败')
	} finally {
		loading.value = false
	}
}

function toggle(id: number) {
	if (selectedIds.value.includes(id)) {
		selectedIds.value = selectedIds.value.filter(v => v !== id)
	} else {
		selectedIds.value.push(id)
	}
}

async function handleConfirm() {
	if (selectedIds.value.length === 0) {
		msgWarning('请至少选择一个文档')
		return
	}
	confirmLoading.value = true
	try {
		const res = await apiAddReferences(props.groupId, selectedIds.value)
		if (res.success) {
			msgSuccess(res.message || '引用成功')
			emit('success')
			visibleLocal.value = false
		} else {
			msgError(res.message || '引用失败')
		}
	} catch {
		msgError('引用失败')
	} finally {
		confirmLoading.value = false
	}
}

watch(() => props.modelValue, (v) => {
	if (v) {
		keyword.value = ''
		sourceGroupId.value = undefined
		selectedIds.value = []
		loadGroupOptions()
		reload()
	}
})
</script>

<style lang="scss" scoped>
.arm-toolbar {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 12px;
}

.arm-count {
	color: var(--df-subtext);
	font-size: 12px;
	flex-shrink: 0;
}

.arm-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-right: 4px;
}

.arm-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	border: 1px solid var(--df-border);
	border-radius: 8px;
}

.arm-item__main {
	flex: 1;
	min-width: 0;
}

.arm-item__title {
	font-weight: 500;
	color: var(--df-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.arm-item__meta {
	margin-top: 4px;
	font-size: 12px;
	color: var(--df-subtext);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
