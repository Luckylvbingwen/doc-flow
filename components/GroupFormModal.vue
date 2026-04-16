<template>
	<el-dialog
class="df-modal" :model-value="visible" :title="mode === 'create' ? '创建组' : '编辑组'" width="520px"
		:close-on-click-modal="false" destroy-on-close @close="close">
		<el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleSubmit">
			<!-- 创建模式：显示位置 -->
			<el-form-item v-if="mode === 'create' && location" label="创建位置">
				<el-input :model-value="location" readonly />
			</el-form-item>

			<el-form-item label="组名称" prop="name">
				<el-input v-model="form.name" placeholder="请输入组名称（全局唯一）" maxlength="150" show-word-limit />
			</el-form-item>

			<el-form-item label="描述" prop="description">
				<el-input
v-model="form.description" type="textarea" placeholder="可选，简要描述该组用途" maxlength="500" show-word-limit
					:rows="3" />
			</el-form-item>
		</el-form>

		<template #footer>
			<el-button @click="close">取消</el-button>
			<el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { apiCreateGroup, apiUpdateGroup } from '~/api/groups'

// ── Props & Events ──
const props = defineProps<{
	visible: boolean
	mode: 'create' | 'edit'
	group?: { id: number; name: string; description: string | null }
	location?: string
	scopeType?: number
	scopeRefId?: number
	parentId?: number
}>()

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'success': []
}>()

// ── 表单状态 ──
const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = ref({
	name: '',
	description: '',
})

const rules: FormRules = {
	name: [{ required: true, message: '请输入组名称', trigger: 'blur' }],
}

// ── 打开时填充编辑数据 ──
watch(() => props.visible, (val) => {
	if (!val) return
	if (props.mode === 'edit' && props.group) {
		form.value.name = props.group.name
		form.value.description = props.group.description ?? ''
	} else {
		form.value.name = ''
		form.value.description = ''
	}
})

// ── 关闭 ──
function close() {
	emit('update:visible', false)
}

// ── 提交 ──
async function handleSubmit() {
	const valid = await formRef.value?.validate().catch(() => false)
	if (!valid) return

	submitting.value = true
	try {
		if (props.mode === 'edit' && props.group) {
			const res = await apiUpdateGroup(props.group.id, {
				name: form.value.name,
				description: form.value.description || undefined,
			})
			if (res.success) {
				msgSuccess(res.message || '操作成功')
				emit('success')
				close()
			} else {
				msgError(res.message || '操作失败')
			}
		} else {
			const res = await apiCreateGroup({
				name: form.value.name,
				description: form.value.description || undefined,
				scopeType: props.scopeType!,
				scopeRefId: props.scopeRefId,
				parentId: props.parentId,
			})
			if (res.success) {
				msgSuccess(res.message || '操作成功')
				emit('success')
				close()
			} else {
				msgError(res.message || '操作失败')
			}
		}
	} catch {
		msgError('操作失败')
	} finally {
		submitting.value = false
	}
}
</script>
