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
