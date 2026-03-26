<template>
	<section class="pf-page-stack">
		<PageTitle title="系统管理" subtitle="角色权限与用户授权" :refreshing="refreshing" @refresh="onRefresh">
			<template #after-title>
				<ClientOnly>
					<el-tag v-if="authStore.roles.length" type="info" size="small" disable-transitions>
						{{ authStore.roles.map(r => r.name).join('、') }}
					</el-tag>
				</ClientOnly>
			</template>
		</PageTitle>

		<TabBar v-model="activeTab" :tabs="tabs" />

		<div class="admin-content">
			<AdminRoleManager v-if="activeTab === 'roles'" ref="roleManagerRef" />
			<AdminUserRoleManager v-else-if="activeTab === 'users'" ref="userRoleManagerRef" />
		</div>
	</section>
</template>

<script setup lang="ts">
const authStore = useAuthStore()

const activeTab = ref('roles')
const roleManagerRef = ref<{ refresh: () => Promise<void>; loading: boolean } | null>(null)
const userRoleManagerRef = ref<{ refresh: () => Promise<void>; loading: boolean } | null>(null)

const refreshing = computed(() => {
	if (activeTab.value === 'roles') return roleManagerRef.value?.loading ?? false
	return userRoleManagerRef.value?.loading ?? false
})

const tabs = [
	{ label: '角色管理', value: 'roles' },
	{ label: '用户授权', value: 'users' }
]

const onRefresh = () => {
	if (activeTab.value === 'roles') {
		roleManagerRef.value?.refresh()
	} else {
		userRoleManagerRef.value?.refresh()
	}
}

definePageMeta({
	layout: 'prototype'
})
</script>

<style lang="scss" scoped>
.admin-content {
	margin-top: 14px;
}
</style>
