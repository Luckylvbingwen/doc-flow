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
			<div class="df-notification-card__footer">
				<span class="df-notification-card__time">{{ formattedTime }}</span>
				<span class="df-notification-card__actions" @click.stop>
					<template v-if="actionType === 'approve'">
						<el-button type="success" size="small" link @click="emit('action', item, 'approve')">同意</el-button>
						<el-button type="danger" size="small" link @click="emit('action', item, 'reject')">拒绝</el-button>
					</template>
					<template v-else-if="actionType === 'revoke'">
						<el-button type="warning" size="small" link @click="emit('action', item, 'revoke')">撤回</el-button>
						<el-button type="primary" size="small" link @click="emit('action', item, 'view')">查看</el-button>
					</template>
					<template v-else>
						<el-button type="primary" size="small" link @click="emit('action', item, 'view')">查看</el-button>
					</template>
				</span>
			</div>
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
	(e: 'action', item: NotificationItem, action: string): void
}>()

const meta = computed(() => getNotificationMeta(props.item.msgCode))

/** 需要"同意/拒绝"按钮的消息类型 */
const APPROVE_CODES = ['M10', 'M12', 'M14', 'M15']
/** 需要"撤回/查看"按钮的消息类型 */
const REVOKE_CODES = ['M6']

const actionType = computed(() => {
	const code = props.item.msgCode
	if (!code) return 'view'
	if (APPROVE_CODES.includes(code)) return 'approve'
	if (REVOKE_CODES.includes(code)) return 'revoke'
	return 'view'
})

const clickable = computed(() => resolveRoute(props.item.bizType, props.item.bizId) !== null || !props.item.read)

const formattedTime = computed(() => formatTime(props.item.createdAt))

function handleClick() {
	emit('click', props.item)
}
</script>
