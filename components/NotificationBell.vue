<template>
	<el-popover
v-model:visible="open" placement="bottom-end" :width="380" trigger="click"
		popper-class="df-notification-popper" :show-arrow="false">
		<template #reference>
			<button
class="df-notification-bell" type="button"
				:aria-label="`通知${displayCount ? `（${displayCount} 条未读）` : ''}`">
				<el-icon :size="18">
					<Bell />
				</el-icon>
				<span
v-if="wsStore.badges.notifications > 0" class="df-notification-bell__dot"
					:class="{ 'df-notification-bell__dot--wide': wsStore.badges.notifications >= 10 }">
					{{ displayCount }}
				</span>
			</button>
		</template>

		<NotificationPopover v-if="open" @close="open = false" />
	</el-popover>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bell } from '@element-plus/icons-vue'
import { useWsStore } from '~/stores/ws'
import { reconcileNotificationBadge } from '~/composables/useNotificationBadge'

const wsStore = useWsStore()
const open = ref(false)

const displayCount = computed(() => {
	const n = wsStore.badges.notifications
	if (n <= 0) return ''
	if (n > 99) return '99+'
	return String(n)
})

// 挂载时拉一次对账（登录完成/页面加载的初始未读数）
onMounted(() => {
	reconcileNotificationBadge()
})
</script>
