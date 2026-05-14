<template>
	<div class="pli-tab">
		<el-form v-loading="loading" label-position="top" class="pli-form">
			<el-form-item label="部门名称">
				<el-input :model-value="info.name" disabled />
				<div v-if="info.isSynced" class="pli-sync-hint">
					<el-icon :size="12">
						<Link />
					</el-icon>
					已与飞书通讯录同步，名称不可修改
				</div>
			</el-form-item>
			<el-form-item label="负责人">
				<el-input :model-value="info.ownerName || '—'" disabled />
				<div v-if="info.isSynced" class="pli-sync-hint">
					<el-icon :size="12">
						<Link />
					</el-icon>
					负责人由飞书同步，不可手动变更
				</div>
			</el-form-item>
			<el-form-item label="描述">
				<el-input
v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit
					:disabled="!canEdit" />
			</el-form-item>
			<el-form-item v-if="canEdit">
				<el-button type="primary" :loading="saving" @click="onSave">保存修改</el-button>
			</el-form-item>
		</el-form>
	</div>
</template>

<script setup lang="ts">
import { Link } from '@element-plus/icons-vue'
import { apiGetDepartment } from '~/api/departments'

const props = defineProps<{
	deptId: number
	deptName: string
}>()

const { hasRole } = useAuth()
const { msgSuccess, msgError } = useNotify()
const canEdit = computed(() => hasRole(['super_admin']))

const loading = ref(false)
const saving = ref(false)
const info = ref({ name: '', ownerName: '', isSynced: false })
const form = ref({ description: '' })

async function loadInfo() {
	loading.value = true
	try {
		const res = await apiGetDepartment(props.deptId)
		if (res.success && res.data) {
			info.value.name = res.data.name
			info.value.ownerName = res.data.ownerName ?? ''
			info.value.isSynced = res.data.isSynced
			form.value.description = res.data.description ?? ''
		}
	} finally {
		loading.value = false
	}
}

async function onSave() {
	saving.value = true
	try {
		const res = await useAuthFetch(`/api/departments/${props.deptId}`, {
			method: 'PUT',
			body: { description: form.value.description },
		})
		if ((res as any).success) {
			msgSuccess((res as any).message || '保存成功')
		} else {
			msgError((res as any).message || '保存失败')
		}
	} catch {
		msgError('保存失败')
	} finally {
		saving.value = false
	}
}

watch(() => props.deptId, () => loadInfo(), { immediate: true })
</script>

<style lang="scss" scoped>
.pli-sync-hint {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	color: var(--df-subtext);
	margin-top: 4px;
}
</style>
