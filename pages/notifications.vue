<!-- pages/notifications.vue -->
<template>
	<section class="pf-page-stack df-notifications-page">
		<PageTitle title="通知中心" subtitle="查看审批通知、系统通知、成员变更消息" :refreshing="loading" @refresh="handleRefresh">
			<template #actions>
				<el-button
type="primary" :disabled="currentTabUnread === 0 || markingAll" :loading="markingAll"
					@click="handleMarkAllCurrentTab">
					<el-icon>
						<Check />
					</el-icon>
					<span>{{ markAllLabel }}</span>
				</el-button>
			</template>
		</PageTitle>

		<div class="df-notifications-page__toolbar">
			<el-tabs v-model="tab" @tab-change="onTabChange">
				<el-tab-pane v-for="t in tabs" :key="t.value" :name="t.value">
					<template #label>
						<span>{{ t.label }}</span>
						<el-badge
v-if="unreadByTab(t.value) > 0" :value="unreadByTab(t.value) > 99 ? '99+' : unreadByTab(t.value)"
							:max="99" class="df-notif-tab-badge" />
					</template>
				</el-tab-pane>
			</el-tabs>

			<el-segmented v-model="onlyUnread" :options="unreadOptions" size="small" />
		</div>

		<div v-loading="loading" class="df-notifications-page__list">
			<EmptyState v-if="!loading && list.length === 0" preset="no-notifications" />
			<NotificationCard v-for="item in list" :key="item.id" :item="item" @click="handleCardClick" />
		</div>

		<Pagination v-if="total > 0" v-model:page="page" v-model:page-size="pageSize" :total="total" @change="load" />
	</section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllRead } from '~/api/notifications'
import { resolveRoute } from '~/utils/notification-meta'
import { useWsStore } from '~/stores/ws'
import type { NotificationItem, NotificationCategory } from '~/types/notification'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
})
useHead({ title: '通知中心 - DocFlow' })

type TabValue = 'all' | '1' | '2' | '3'

const tabs: Array<{ value: TabValue, label: string }> = [
	{ value: 'all', label: '全部' },
	{ value: '1', label: '审批通知' },
	{ value: '2', label: '系统通知' },
	{ value: '3', label: '成员变更' },
]

const tab = ref<TabValue>('all')
const onlyUnread = ref<boolean>(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const list = ref<NotificationItem[]>([])
const loading = ref(false)
const markingAll = ref(false)

const unreadOptions = [
	{ label: '全部', value: false },
	{ label: '只看未读', value: true },
]

const wsStore = useWsStore()

// 每 Tab 未读数镜像（首次来自 /unread-count，后续由本地操作维护）
const byCategory = ref<{ '1': number, '2': number, '3': number }>({ '1': 0, '2': 0, '3': 0 })

const currentTabUnread = computed(() => unreadByTab(tab.value))

const markAllLabel = computed(() => {
	if (tab.value === 'all') return '全部标为已读'
	const t = tabs.find(x => x.value === tab.value)
	return `${t?.label ?? ''} — 全部标为已读`
})

function unreadByTab(value: TabValue): number {
	if (value === 'all') return byCategory.value['1'] + byCategory.value['2'] + byCategory.value['3']
	return byCategory.value[value as '1' | '2' | '3']
}

async function loadUnreadCount() {
	try {
		const res = await fetchUnreadCount()
		if (res.success) {
			byCategory.value = res.data.byCategory
			wsStore.badges.notifications = res.data.total
		}
	} catch { /* 静默 */ }
}

async function load() {
	loading.value = true
	try {
		const category: NotificationCategory | undefined = tab.value === 'all' ? undefined : (Number(tab.value) as NotificationCategory)
		const res = await fetchNotifications({
			category,
			onlyUnread: onlyUnread.value,
			page: page.value,
			pageSize: pageSize.value,
		})
		if (res.success) {
			list.value = res.data.list
			total.value = res.data.total
		} else {
			list.value = []
			total.value = 0
			msgError(res.message || '加载通知失败')
		}
	} catch (e) {
		msgError((e as Error)?.message || '加载通知失败')
	} finally {
		loading.value = false
	}
}

function onTabChange() {
	page.value = 1
	load()
}

async function handleRefresh() {
	await Promise.all([loadUnreadCount(), load()])
}

watch(onlyUnread, () => {
	page.value = 1
	load()
})

onMounted(async () => {
	await loadUnreadCount()
	await load()
})

async function handleCardClick(item: NotificationItem) {
	if (!item.read) {
		try {
			await markNotificationRead(item.id)
			const row = list.value.find(x => x.id === item.id)
			if (row) {
				row.read = true
				row.readAt = Date.now()
			}
			const cat = String(item.category) as '1' | '2' | '3'
			if (byCategory.value[cat] > 0) byCategory.value[cat] -= 1
			wsStore.badges.notifications = Math.max(0, wsStore.badges.notifications - 1)
		} catch {
			// 静默；WS 会推
		}
	}

	const target = resolveRoute(item.bizType, item.bizId)
	if (target) navigateTo(target)
}

async function handleMarkAllCurrentTab() {
	markingAll.value = true
	try {
		const body = tab.value === 'all' ? {} : { category: Number(tab.value) as NotificationCategory }
		const res = await markAllRead(body)
		if (res.success) {
			msgSuccess(`已全部标为已读（${res.data.updated} 条）`)
			if (tab.value === 'all') {
				byCategory.value = { '1': 0, '2': 0, '3': 0 }
				wsStore.badges.notifications = 0
			} else {
				const cat = tab.value as '1' | '2' | '3'
				const before = byCategory.value[cat]
				byCategory.value[cat] = 0
				wsStore.badges.notifications = Math.max(0, wsStore.badges.notifications - before)
			}
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
</script>
