<template>
	<div class="df-share-landing">
		<div v-if="loading" class="df-share-landing__loading">
			<el-icon class="is-loading" :size="32" color="var(--df-primary)">
				<Loading />
			</el-icon>
			<p>正在验证分享链接…</p>
		</div>
		<div v-else-if="error" class="df-share-landing__error">
			<el-icon :size="48" color="#ef4444">
				<CircleCloseFilled />
			</el-icon>
			<h3>链接无效</h3>
			<p>{{ error }}</p>
			<el-button type="primary" @click="navigateTo('/docs')">返回首页</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Loading, CircleCloseFilled } from '@element-plus/icons-vue'
import { apiOpenShareLink } from '~/api/share'

definePageMeta({ layout: 'default' })
useHead({ title: '分享链接 - DocFlow' })

const route = useRoute()
const token = computed(() => String(route.params.token || ''))

const loading = ref(true)
const error = ref('')

onMounted(async () => {
	if (!token.value) {
		error.value = '分享链接无效'
		loading.value = false
		return
	}

	try {
		const res = await apiOpenShareLink(token.value)
		if (res.success) {
			// 成功 → 跳转文档详情
			navigateTo(`/docs/file/${res.data.documentId}`, { replace: true })
		} else {
			error.value = res.message || '分享链接无效或已过期'
			loading.value = false
		}
	} catch {
		error.value = '验证分享链接失败'
		loading.value = false
	}
})
</script>

<style scoped>
.df-share-landing {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 60vh;
}

.df-share-landing__loading,
.df-share-landing__error {
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	color: var(--df-subtext);
}

.df-share-landing__error h3 {
	margin: 0;
	color: var(--df-text);
}
</style>
