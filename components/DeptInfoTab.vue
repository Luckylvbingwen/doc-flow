<template>
	<div class="pli-tab">
		<el-alert
v-if="info.feishuRevoked" title="该部门在飞书组织架构中已被撤销" type="warning" :closable="false" show-icon
			class="dept-revoked-alert">
			<template #default>
				请及时处理该部门下的子组和文档。确认无误后可删除该部门。
			</template>
		</el-alert>
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
			<el-form-item v-if="info.feishuRevoked && canDelete">
				<el-button type="danger" :loading="deleting" @click="onDelete">删除部门</el-button>
			</el-form-item>
		</el-form>
	</div>
</template>

<script setup lang="ts">
import { Link } from '@element-plus/icons-vue'
import { apiGetDepartment, apiDeleteDepartment } from '~/api/departments'

const props = defineProps<{
	deptId: number
	deptName: string
}>()

const emit = defineEmits<{
	'deleted': []
}>()

const { hasRole } = useAuth()
const authStore = useAuthStore()
const { msgSuccess, msgError, msgConfirm } = useNotify()
const canEdit = computed(() => hasRole(['super_admin']))
const canDelete = computed(() => hasRole(['super_admin']) || info.value.isDeptOwner)

const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const info = ref({ name: '', ownerName: '', isSynced: false, feishuRevoked: false, isDeptOwner: false })
const form = ref({ description: '' })

async function loadInfo() {
	loading.value = true
	try {
		const res = await apiGetDepartment(props.deptId)
		if (res.success && res.data) {
			info.value.name = res.data.name
			info.value.ownerName = res.data.ownerName ?? ''
			info.value.isSynced = res.data.isSynced
			info.value.feishuRevoked = res.data.feishuRevoked
			info.value.isDeptOwner = res.data.ownerUserId === authStore.user?.id
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

async function onDelete() {
	const confirmed = await msgConfirm('确定删除该部门？删除后不可恢复。', '删除部门', { danger: true })
	if (!confirmed) return
	deleting.value = true
	try {
		const res = await apiDeleteDepartment(props.deptId)
		if (res.success) {
			msgSuccess(res.message || '部门已删除')
			emit('deleted')
		} else {
			msgError(res.message || '删除失败')
		}
	} catch {
		msgError('删除失败')
	} finally {
		deleting.value = false
	}
}

watch(() => props.deptId, () => loadInfo(), { immediate: true })
</script>

<style lang="scss" scoped>
.dept-revoked-alert {
	margin-bottom: 16px;
}

.pli-sync-hint {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	color: var(--df-subtext);
	margin-top: 4px;
}
</style>
