<template>
	<article
class="df-notification-card" :class="{
		'df-notification-card--unread': !item.read,
		'df-notification-card--clickable': clickable,
	}" @click="handleClick">
		<div class="df-notification-card__icon" :data-color="meta.color">
			<el-icon :size="16">
				<component :is="meta.icon" />
			</el-icon>
		</div>
		<div class="df-notification-card__body">
			<div class="df-notification-card__title">{{ item.title }}</div>
			<div v-if="item.content" class="df-notification-card__content">{{ item.content }}</div>
			<div class="df-notification-card__time">{{ formattedTime }}</div>
		</div>
		<span v-if="!item.read" class="df-notification-card__dot" aria-label="未读" />
	</article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getNotificationMeta, resolveRoute } from '~/utils/notification-meta'
import { formatTime } from '~/utils/format'
import type { NotificationItem } from '~/types/notification'

const props = defineProps<{
	item: NotificationItem
}>()

const emit = defineEmits<{
	(e: 'click', item: NotificationItem): void
}>()

const meta = computed(() => getNotificationMeta(props.item.msgCode))

const clickable = computed(() => resolveRoute(props.item.bizType, props.item.bizId) !== null || !props.item.read)

const formattedTime = computed(() => formatTime(props.item.createdAt))

function handleClick() {
	emit('click', props.item)
}
</script>
