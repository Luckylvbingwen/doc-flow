<template>
	<ClientOnly>
		<Teleport to="body">
			<Transition name="df-bulk-bar">
				<div v-if="count > 0" class="df-bulk-bar" role="toolbar" :aria-label="ariaLabel">
					<div class="df-bulk-bar__count">
						<el-icon class="df-bulk-bar__check-icon"><Select /></el-icon>
						<span>已选 <strong>{{ count }}</strong> {{ unit }}</span>
					</div>

					<span class="df-bulk-bar__divider" />

					<div class="df-bulk-bar__actions">
						<slot />
					</div>

					<span class="df-bulk-bar__divider" />

					<button class="df-bulk-bar__close" title="取消选择" @click="$emit('clear')">
						<el-icon>
							<Close />
						</el-icon>
					</button>
				</div>
			</Transition>
		</Teleport>
	</ClientOnly>
</template>

<script setup lang="ts">
import { Select, Close } from '@element-plus/icons-vue'

interface Props {
	/** 已选中数量 */
	count: number
	/** 计数单位 */
	unit?: string
	/** 无障碍标签 */
	ariaLabel?: string
}

withDefaults(defineProps<Props>(), {
	unit: '个文件',
	ariaLabel: '批量操作栏',
})

defineEmits<{
	clear: []
}>()
</script>
