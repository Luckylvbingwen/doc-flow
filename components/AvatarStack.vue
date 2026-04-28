<template>
	<div v-if="users.length" class="df-avatar-stack" :title="tooltipText">
		<div
v-for="(user, i) in visibleUsers" :key="user.id" class="df-avatar-stack__item"
			:style="{ zIndex: visibleUsers.length - i, backgroundColor: getColor(user.name) }">
			{{ user.name.slice(0, 1) }}
		</div>
		<div v-if="overflowCount > 0" class="df-avatar-stack__item df-avatar-stack__overflow" :style="{ zIndex: 0 }">
			+{{ overflowCount }}
		</div>
	</div>
</template>

<script setup lang="ts">
export interface AvatarUser {
	id: number
	name: string
}

const props = withDefaults(defineProps<{
	users: AvatarUser[]
	max?: number
}>(), {
	max: 3,
})

const visibleUsers = computed(() => props.users.slice(0, props.max))
const overflowCount = computed(() => Math.max(0, props.users.length - props.max))
const tooltipText = computed(() => props.users.map(u => u.name).join(', '))

const COLORS = ['#ec4899', '#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6']

function getColor(name: string): string {
	let hash = 0
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash)
	}
	return COLORS[Math.abs(hash) % COLORS.length]
}
</script>
