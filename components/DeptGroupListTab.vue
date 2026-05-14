<template>
	<div class="plg-tab">
		<div class="plg-toolbar">
			<span class="plg-toolbar__title">下属组列表</span>
			<span class="plg-toolbar__count">共 {{ groupList.length }} 个顶级组，{{ totalCount }} 个组（含子组）</span>
			<el-button type="primary" size="small" @click="emit('create-group')">
				<el-icon :size="13">
					<Plus />
				</el-icon>
				创建组
			</el-button>
		</div>

		<div v-loading="loading" class="plg-table-wrap">
			<el-table :data="groupList" size="default" stripe>
				<el-table-column label="组名称" min-width="160">
					<template #default="{ row }">
						<span class="plg-group-name" @click="emit('navigate-group', row.id)">{{ row.name }}</span>
					</template>
				</el-table-column>
				<el-table-column prop="ownerName" label="负责人" width="100" />
				<el-table-column prop="fileCount" label="文件数" width="80" align="center" />
				<el-table-column prop="memberCount" label="成员数" width="80" align="center" />
				<el-table-column label="子组数" width="80" align="center">
					<template #default="{ row }">
						{{ row.childCount > 0 ? row.childCount : '-' }}
					</template>
				</el-table-column>
				<el-table-column label="更新时间" width="150">
					<template #default="{ row }">
						{{ formatTime(row.updatedAt, 'YYYY-MM-DD HH:mm') }}
					</template>
				</el-table-column>
				<el-table-column label="操作" width="140" align="center">
					<template #default="{ row }">
						<el-button type="primary" text size="small" @click="emit('navigate-group', row.id)">管理</el-button>
						<el-button type="danger" text size="small" @click="handleDelete(row)">删除</el-button>
					</template>
				</el-table-column>
			</el-table>
			<div v-if="!loading && groupList.length === 0" class="plg-empty">
				<el-icon :size="36" color="var(--df-subtext)" style="opacity: 0.3">
					<Folder />
				</el-icon>
				<p>暂无下属组</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Folder, Plus } from '@element-plus/icons-vue'
import { apiGetDeptGroups } from '~/api/departments'
import type { DeptGroupItem } from '~/api/departments'
import { formatTime } from '~/utils/format'

const props = defineProps<{
	deptId: number
}>()

const emit = defineEmits<{
	'count-change': [count: number]
	'navigate-group': [groupId: number]
	'create-group': []
	'delete-group': [group: DeptGroupItem]
}>()

const { msgError } = useNotify()

const loading = ref(false)
const groupList = ref<DeptGroupItem[]>([])
const totalCount = ref(0)

async function loadGroups() {
	loading.value = true
	try {
		const res = await apiGetDeptGroups(props.deptId)
		if (res.success && res.data) {
			groupList.value = res.data.groups
			totalCount.value = res.data.totalCount
			emit('count-change', res.data.groups.length)
		}
	} finally {
		loading.value = false
	}
}

async function handleDelete(group: DeptGroupItem) {
	if (group.fileCount > 0 || group.childCount > 0) {
		msgError(`组「${group.name}」下有文档或子组，删除前需先迁移或删除所有内容。`)
		return
	}
	emit('delete-group', group)
}

watch(() => props.deptId, () => loadGroups(), { immediate: true })

defineExpose({ refresh: loadGroups })
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
