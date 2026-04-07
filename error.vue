<template>
	<div class="df-error-page">
		<div class="df-error-card">
			<div class="df-error-code">{{ error?.statusCode || 500 }}</div>
			<h1 class="df-error-title">{{ title }}</h1>
			<p class="df-error-message">{{ message }}</p>
			<div class="df-error-actions">
				<el-button type="primary" @click="goHome">返回首页</el-button>
				<el-button @click="handleError">重试</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
	error: NuxtError
}>()

const title = computed(() => {
	const code = props.error?.statusCode
	if (code === 404) return '页面未找到'
	if (code === 403) return '没有访问权限'
	if (code === 401) return '请先登录'
	return '出了点问题'
})

const message = computed(() => {
	if (props.error?.statusMessage) return props.error.statusMessage
	const code = props.error?.statusCode
	if (code === 404) return '您访问的页面不存在或已被移除。'
	if (code === 403) return '您没有权限访问此页面，请联系管理员。'
	if (code === 401) return '您的登录已过期，请重新登录。'
	return '服务器开了个小差，请稍后再试。'
})

const goHome = () => clearError({ redirect: '/docs' })
const handleError = () => clearError({ redirect: props.error?.statusCode === 401 ? '/login' : '/docs' })
</script>

<style lang="scss" scoped>
.df-error-page {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
	background: var(--df-bg, #f5f5f5);
	padding: 24px;
}

.df-error-card {
	text-align: center;
	max-width: 440px;
}

.df-error-code {
	font-size: 96px;
	font-weight: 800;
	line-height: 1;
	background: linear-gradient(135deg, var(--df-primary, #2563eb), #3b82f6);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
	margin-bottom: 12px;
}

.df-error-title {
	font-size: 22px;
	font-weight: 600;
	color: var(--df-text, #1f2937);
	margin: 0 0 8px;
}

.df-error-message {
	font-size: 14px;
	color: var(--df-subtext, #71717a);
	margin: 0 0 28px;
	line-height: 1.6;
}

.df-error-actions {
	display: flex;
	justify-content: center;
	gap: 12px;
}
</style>
