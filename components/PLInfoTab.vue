<template>
	<div class="pli-tab">
		<el-form v-loading="loading" label-position="top" class="pli-form">
			<el-form-item label="产品线名称">
				<el-input v-model="form.name" maxlength="150" show-word-limit :disabled="!canEdit" />
			</el-form-item>
			<el-form-item label="描述">
				<el-input
v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit
					:disabled="!canEdit" />
			</el-form-item>
			<el-form-item label="负责人">
				<el-input :model-value="ownerName" disabled />
			</el-form-item>
			<el-form-item v-if="canEdit">
				<el-button type="primary" :loading="saving" @click="onSave">保存修改</el-button>
			</el-form-item>
		</el-form>

		<!-- 危险区域 -->
		<div v-if="canEdit" class="pli-danger">
			<div class="pli-danger__header">
				<span class="pli-danger__title">危险操作</span>
			</div>
			<div class="pli-danger__body">
				<div class="pli-danger__row">
					<div>
						<div class="pli-danger__label">删除产品线</div>
						<div class="pli-danger__hint">
							{{ groupCount > 0 ? '请先迁移或删除所有下属项目组' : '删除后不可恢复' }}
						</div>
					</div>
					<el-button type="danger" size="small" :disabled="groupCount > 0" :loading="deleting" @click="onDelete">
						删除
					</el-button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { apiGetProductLines, apiUpdateProductLine, apiDeleteProductLine } from '~/api/product-lines'
import type { ProductLineItem } from '~/types/group'

const props = defineProps<{
	plId: number
	plName: string
}>()

const emit = defineEmits<{ updated: [] }>()

const { hasRole } = useAuth()
const canEdit = computed(() => hasRole(['super_admin', 'pl_head']))

const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const form = ref({ name: '', description: '' })
const ownerName = ref('')
const groupCount = ref(0)

async function loadInfo() {
	loading.value = true
	try {
		const res = await apiGetProductLines()
		if (res.success) {
			const pl = (res.data as ProductLineItem[]).find(p => p.id === props.plId)
			if (pl) {
				form.value.name = pl.name
				form.value.description = pl.description ?? ''
				ownerName.value = pl.ownerName ?? '—'
				groupCount.value = pl.groupCount
			}
		}
	} finally {
		loading.value = false
	}
}

async function onSave() {
	if (!form.value.name.trim()) {
		msgError('名称不能为空')
		return
	}
	saving.value = true
	try {
		const res = await apiUpdateProductLine(props.plId, {
			name: form.value.name.trim(),
			description: form.value.description.trim() || undefined,
		})
		if (res.success) {
			msgSuccess(res.message || '已保存')
			emit('updated')
		} else {
			msgError(res.message || '保存失败')
		}
	} finally {
		saving.value = false
	}
}

async function onDelete() {
	const ok = await msgConfirm('确定删除该产品线？此操作不可撤销。', '删除产品线', { type: 'warning', danger: true })
	if (!ok) return

	deleting.value = true
	try {
		const res = await apiDeleteProductLine(props.plId)
		if (res.success) {
			msgSuccess(res.message || '已删除')
			emit('updated')
		} else {
			msgError(res.message || '删除失败')
		}
	} finally {
		deleting.value = false
	}
}

watch(() => props.plId, () => { if (props.plId) loadInfo() }, { immediate: true })
</script>

<style lang="scss" scoped>
.pli-tab {
	display: flex;
	flex-direction: column;
	gap: 24px;
}

.pli-form {
	max-width: 480px;
}

.pli-danger {
	border: 1px solid var(--el-color-danger-light-5);
	border-radius: 8px;
	overflow: hidden;

	&__header {
		padding: 12px 16px;
		background: var(--el-color-danger-light-9);
	}

	&__title {
		font-size: 14px;
		font-weight: 600;
		color: var(--el-color-danger);
	}

	&__body {
		padding: 16px;
	}

	&__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	&__label {
		font-size: 14px;
		font-weight: 500;
		color: var(--df-text);
	}

	&__hint {
		font-size: 12px;
		color: var(--df-subtext);
		margin-top: 2px;
	}
}
</style>
