<template>
	<div class="df-404-page">
		<div class="df-404-card">
			<div class="df-404-code">404</div>
			<h1 class="df-404-title">页面未找到</h1>
			<p class="df-404-message">您访问的页面不存在或已被移除。</p>
			<p class="df-404-path">{{ route.path }}</p>
			<div class="df-404-actions">
				<el-button type="primary" @click="navigateTo('/docs')">返回首页</el-button>
				<el-button @click="router.back()">返回上页</el-button>
			</div>
		</div>
	</div>
</template>

<script setup>
definePageMeta({ layout: 'default' })
useHead({ title: '404 - DocFlow' })

const route = useRoute()
const router = useRouter()
</script>

<style lang="scss" scoped>
.df-404-page {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
	background: var(--df-bg, #f5f5f5);
	padding: 24px;
}

.df-404-card {
	text-align: center;
	max-width: 440px;
}

.df-404-code {
	font-size: 120px;
	font-weight: 800;
	line-height: 1;
	color: var(--df-primary, #409eff);
	opacity: .15;
	user-select: none;
}

.df-404-title {
	font-size: 24px;
	font-weight: 600;
	margin: -16px 0 8px;
	color: var(--df-text, #303133);
}

.df-404-message {
	color: var(--df-subtext, #909399);
	font-size: 14px;
	margin-bottom: 4px;
}

.df-404-path {
	color: var(--df-subtext, #909399);
	font-size: 12px;
	font-family: monospace;
	margin-bottom: 24px;
	word-break: break-all;
}

.df-404-actions {
	display: flex;
	justify-content: center;
	gap: 12px;
}
</style>
