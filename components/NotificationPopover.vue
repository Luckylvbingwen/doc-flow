<template>
	<div class="df-notification-popover">
		<header class="df-notification-popover__head">
			<el-segmented v-model="filterMode" :options="segmentOptions" size="small" />
		</header>

		<div v-loading="loading" class="df-notification-popover__body">
			<el-scrollbar>
				<EmptyState v-if="!loading && list.length === 0" preset="no-notifications" compact />
				<NotificationCard v-for="item in list" :key="item.id" :item="item" @click="handleCardClick" />
			</el-scrollbar>
		</div>

		<footer class="df-notification-popover__foot">
			<el-button
type="primary" text :disabled="unreadTotal === 0 || markingAll" :loading="markingAll"
				@click="handleMarkAll">
				全部标为已读
			</el-button>
			<el-button text @click="handleViewAll">
				查看全部
				<el-icon class="el-icon--right">
					<ArrowRight />
				</el-icon>
			</el-button>
		</footer>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { fetchNotifications, markNotificationRead, markAllRead } from '~/api/notifications'
import { resolveRoute } from '~/utils/notification-meta'
import { reconcileNotificationBadge } from '~/composables/useNotificationBadge'
import { useWsStore } from '~/stores/ws'
import type { NotificationItem } from '~/types/notification'

const emit = defineEmits<{ (e: 'close'): void }>()

const wsStore = useWsStore()

const filterMode = ref<'unread' | 'all'>('unread')

const segmentOptions = computed(() => {
	const count = wsStore.badges.notifications
	const label = count > 0 ? `未读(${count > 99 ? '99+' : count})` : '未读'
	return [
		{ label, value: 'unread' },
		{ label: '全部', value: 'all' },
	]
})

const list = ref<NotificationItem[]>([])
const loading = ref(false)
const markingAll = ref(false)
const unreadTotal = computed(() => wsStore.badges.notifications)

async function load() {
	loading.value = true
	try {
		const res = await fetchNotifications({
			onlyUnread: filterMode.value === 'unread',
			pageSize: 20,
			page: 1,
		})
		if (res.success) {
			list.value = res.data.list
		} else {
			list.value = []
			msgError(res.message || '加载通知失败')
		}
	} catch (e) {
		list.value = []
		msgError((e as Error)?.message || '加载通知失败')
	} finally {
		loading.value = false
	}
}

watch(filterMode, load)

onMounted(() => {
	// 每次打开 Popover 都刷新一次未读计数，防止 wsStore.badges.notifications 因
	// 初始对账失败/WS 从未重连而长时间停在 0
	reconcileNotificationBadge()
	load()
})

async function handleCardClick(item: NotificationItem) {
	// 标已读（仅未读需要）
	if (!item.read) {
		try {
			await markNotificationRead(item.id)
			const row = list.value.find(x => x.id === item.id)
			if (row) {
				row.read = true
				row.readAt = Date.now()
			}
		} catch {
			// 静默；WS 会同步 badge
		}
	}

	// 跳转
	const target = resolveRoute(item.bizType, item.bizId)
	if (target) navigateTo(target)

	// 关面板
	emit('close')
}

async function handleMarkAll() {
	if (unreadTotal.value === 0) return
	markingAll.value = true
	try {
		const res = await markAllRead({})
		if (res.success) {
			msgSuccess(`已全部标为已读（${res.data.updated} 条）`)
			wsStore.badges.notifications = 0
			await load()
		} else {
			msgError(res.message || '操作失败')
		}
	} catch (e) {
		msgError((e as Error)?.message || '操作失败')
	} finally {
		markingAll.value = false
	}
}

function handleViewAll() {
	navigateTo('/notifications')
	emit('close')
}

defineExpose({ refresh: load })
</script>
