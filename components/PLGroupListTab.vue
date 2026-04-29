<template>
	<div class="plg-tab">
		<div class="plg-toolbar">
			<span class="plg-toolbar__title">项目组列表</span>
		</div>

		<div v-loading="loading" class="plg-table-wrap">
			<el-table :data="groupList" size="default" stripe>
				<el-table-column label="项目组名称" min-width="160">
					<template #default="{ row }">
						<span class="plg-group-name" @click="emit('navigate-group', row.id)">{{ row.name }}</span>
					</template>
				</el-table-column>
				<el-table-column prop="description" label="描述" min-width="140" show-overflow-tooltip />
				<el-table-column prop="ownerName" label="负责人" width="100" />
				<el-table-column prop="fileCount" label="文件数" width="80" align="center" />
				<el-table-column prop="memberCount" label="成员数" width="80" align="center" />
				<el-table-column prop="childCount" label="子组数" width="80" align="center" />
				<el-table-column label="更新时间" width="150">
					<template #default="{ row }">
						{{ formatTime(row.updatedAt, 'YYYY-MM-DD HH:mm') }}
					</template>
				</el-table-column>
			</el-table>
			<div v-if="!loading && groupList.length === 0" class="plg-empty">
				<el-icon :size="36" color="var(--df-subtext)" style="opacity: 0.3">
					<Folder />
				</el-icon>
				<p>暂无下属项目组</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Folder } from '@element-plus/icons-vue'
import { apiGetPLGroups } from '~/api/product-lines'
import type { PLGroupItem } from '~/api/product-lines'
import { formatTime } from '~/utils/format'

const props = defineProps<{
	plId: number
}>()

const emit = defineEmits<{
	'count-change': [count: number]
	'navigate-group': [groupId: number]
}>()

const loading = ref(false)
const groupList = ref<PLGroupItem[]>([])

async function loadGroups() {
	loading.value = true
	try {
		const res = await apiGetPLGroups(props.plId)
		if (res.success && res.data) {
			groupList.value = res.data
			emit('count-change', res.data.length)
		}
	} finally {
		loading.value = false
	}
}

watch(() => props.plId, () => { if (props.plId) loadGroups() }, { immediate: true })
</script>

<style lang="scss" scoped>
.plg-tab {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.plg-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;

	&__title {
		font-size: 14px;
		font-weight: 600;
		color: var(--df-text);
	}
}

.plg-table-wrap {
	min-height: 100px;
}

.plg-group-name {
	color: var(--df-primary);
	cursor: pointer;
	font-weight: 500;

	&:hover {
		text-decoration: underline;
	}
}

.plg-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 40px 0;
	color: var(--df-subtext);
	font-size: 13px;
}
</style>
