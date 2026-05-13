<template>
	<Modal
v-model:visible="visible" title="导入飞书文档" confirm-text="开始导入" :confirm-loading="importing"
		:disabled="!form.feishuUrl.trim()" width="520px" @confirm="handleImport" @close="resetForm">
		<el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
			<el-form-item label="飞书文档链接" prop="feishuUrl" required>
				<el-input
v-model="form.feishuUrl" placeholder="https://xxxx.feishu.cn/docx/..." clearable
					@keyup.enter="handleImport" />
				<div class="feishu-import__hint">
					支持飞书云文档（docx / docs 格式），导入后自动转为 Markdown 并进入审批流程
				</div>
			</el-form-item>

			<el-form-item label="变更说明（可选）" prop="changeNote">
				<el-input
v-model="form.changeNote" type="textarea" :rows="2" placeholder="说明此次导入的背景或用途..." maxlength="500"
					show-word-limit />
			</el-form-item>
		</el-form>
	</Modal>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { apiFeishuImport } from '~/api/groups'

const props = defineProps<{
	visible: boolean
	groupId: number
}>()

const emit = defineEmits<{
	'update:visible': [val: boolean]
	success: []
}>()

const visible = computed({
	get: () => props.visible,
	set: val => emit('update:visible', val),
})

const formRef = ref<FormInstance>()
const importing = ref(false)

const form = reactive({
	feishuUrl: '',
	changeNote: '',
})

const rules: FormRules = {
	feishuUrl: [
		{ required: true, message: '请输入飞书文档链接' },
		{
			validator: (_rule, value: string, callback) => {
				if (!value) { callback(); return }
				try {
					const u = new URL(value)
					const hasFeiShuHost = u.hostname.endsWith('.feishu.cn') || u.hostname.endsWith('.larksuite.com')
					const hasDocPath = /\/(docx|docs|doc|wiki)\//.test(u.pathname)
					if (!hasFeiShuHost || !hasDocPath) {
						callback(new Error('请输入有效的飞书文档链接（需包含 /docx/ 或 /docs/）'))
					} else {
						callback()
					}
				} catch {
					callback(new Error('请输入有效的 URL'))
				}
			},
			trigger: 'blur',
		},
	],
}

async function handleImport() {
	const valid = await formRef.value?.validate().catch(() => false)
	if (!valid) return

	importing.value = true
	try {
		const res = await apiFeishuImport(props.groupId, {
			feishuUrl: form.feishuUrl.trim(),
			changeNote: form.changeNote.trim() || undefined,
		})
		if (res.success) {
			msgSuccess(res.message || '文档已导入，正在进入审批流程')
			visible.value = false
			emit('success')
		} else {
			msgError(res.message || '导入失败，请稍后重试')
		}
	} finally {
		importing.value = false
	}
}

function resetForm() {
	form.feishuUrl = ''
	form.changeNote = ''
	formRef.value?.clearValidate()
}
</script>

<style lang="scss" scoped>
.feishu-import__hint {
	margin-top: 4px;
	font-size: 12px;
	color: var(--df-subtext);
	line-height: 1.5;
}
</style>
