<template>
	<el-drawer v-model="visible" :title="title" :size="size" :direction="direction"
		:close-on-click-modal="closeOnClickModal" :close-on-press-escape="closeOnPressEscape"
		:destroy-on-close="destroyOnClose" :append-to-body="appendToBody" class="df-detail-drawer" @close="onClose">
		<template #header>
			<div class="df-drawer-header">
				<span class="df-drawer-title">{{ title }}</span>
				<slot name="header-extra" />
			</div>
		</template>

		<div class="df-drawer-body">
			<slot />
		</div>

		<template v-if="$slots.footer" #footer>
			<div class="df-drawer-footer">
				<slot name="footer" />
			</div>
		</template>
	</el-drawer>
</template>

<script setup>
const props = defineProps({
	modelValue: { type: Boolean, default: false },
	title: { type: String, default: '详情' },
	size: { type: [String, Number], default: '560px' },
	direction: { type: String, default: 'rtl' },
	closeOnClickModal: { type: Boolean, default: true },
	closeOnPressEscape: { type: Boolean, default: true },
	destroyOnClose: { type: Boolean, default: false },
	appendToBody: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'close'])

const visible = computed({
	get: () => props.modelValue,
	set: (val) => emit('update:modelValue', val)
})

const onClose = () => {
	emit('close')
}
</script>
