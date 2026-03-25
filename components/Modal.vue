<template>
	<el-dialog v-model="visible" :title="title" :width="width" :top="top" :fullscreen="fullscreen"
		:close-on-click-modal="closeOnClickModal" :close-on-press-escape="closeOnPressEscape"
		:destroy-on-close="destroyOnClose" :append-to-body="appendToBody" :draggable="draggable" class="df-modal"
		@close="onClose">
		<template v-if="$slots.header" #header>
			<slot name="header" />
		</template>

		<div class="df-modal-body">
			<slot />
		</div>

		<template #footer>
			<slot name="footer">
				<el-button @click="visible = false">{{ cancelText }}</el-button>
				<el-button type="primary" :loading="confirmLoading" @click="onConfirm">
					{{ confirmText }}
				</el-button>
			</slot>
		</template>
	</el-dialog>
</template>

<script setup>
const props = defineProps({
	modelValue: { type: Boolean, default: false },
	title: { type: String, default: '' },
	width: { type: [String, Number], default: '520px' },
	top: { type: String, default: '15vh' },
	fullscreen: { type: Boolean, default: false },
	closeOnClickModal: { type: Boolean, default: false },
	closeOnPressEscape: { type: Boolean, default: true },
	destroyOnClose: { type: Boolean, default: false },
	appendToBody: { type: Boolean, default: true },
	draggable: { type: Boolean, default: false },
	confirmText: { type: String, default: '确定' },
	cancelText: { type: String, default: '取消' },
	confirmLoading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'close', 'confirm'])

const visible = computed({
	get: () => props.modelValue,
	set: (val) => emit('update:modelValue', val)
})

const onClose = () => emit('close')
const onConfirm = () => emit('confirm')
</script>

<style scoped>
/* scoped 内只保留 body 滚动 */
.df-modal-body {
	max-height: 60vh;
	overflow-y: auto;
}
</style>

<style>
/* ── df-modal 全局层叠覆盖（el-dialog 渲染在 body 下） ── */
.df-modal {
	border-radius: 16px;
	overflow: hidden;
	box-shadow:
		0 24px 48px -12px rgba(16, 24, 40, 0.18),
		0 0 0 1px rgba(0, 0, 0, 0.03);
	padding: 0;
}

.df-modal .el-dialog__header {
	padding: 22px 24px 18px;
	margin-right: 0;
	border-bottom: 1px solid var(--df-border);
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.df-modal .el-dialog__header .el-dialog__title {
	font-size: 16px;
	font-weight: 600;
}

.df-modal .el-dialog__body {
	padding: 24px;
}

.df-modal .el-dialog__footer {
	padding: 16px 24px;
	border-top: 1px solid var(--df-border);
	background: var(--df-surface);
}

html.dark .df-modal {
	box-shadow:
		0 24px 48px -12px rgba(0, 0, 0, 0.5),
		0 0 0 1px rgba(255, 255, 255, 0.05);
}
</style>
