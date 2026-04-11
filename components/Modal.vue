<template>
	<el-dialog
v-model="visible" :title="title" :width="width" :top="top" :fullscreen="fullscreen"
		:close-on-click-modal="closeOnClickModal" :close-on-press-escape="closeOnPressEscape"
		:destroy-on-close="destroyOnClose" :append-to-body="appendToBody" :draggable="draggable" class="df-modal"
		@close="onClose">
		<template v-if="$slots.header" #header>
			<slot name="header" />
		</template>

		<el-scrollbar max-height="60vh" class="df-modal-body">
			<slot />
		</el-scrollbar>

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

<script setup lang="ts">
interface ModalProps {
	modelValue?: boolean
	title?: string
	width?: string | number
	top?: string
	fullscreen?: boolean
	closeOnClickModal?: boolean
	closeOnPressEscape?: boolean
	destroyOnClose?: boolean
	appendToBody?: boolean
	draggable?: boolean
	confirmText?: string
	cancelText?: string
	confirmLoading?: boolean
}

const props = withDefaults(defineProps<ModalProps>(), {
	modelValue: false,
	title: '',
	width: '520px',
	top: '15vh',
	fullscreen: false,
	closeOnClickModal: false,
	closeOnPressEscape: true,
	destroyOnClose: false,
	appendToBody: true,
	draggable: false,
	confirmText: '确定',
	cancelText: '取消',
	confirmLoading: false,
})

const emit = defineEmits<{
	'update:modelValue': [value: boolean]
	'close': []
	'confirm': []
}>()

const visible = computed({
	get: () => props.modelValue,
	set: (val) => emit('update:modelValue', val)
})

const onClose = () => emit('close')
const onConfirm = () => emit('confirm')
</script>
