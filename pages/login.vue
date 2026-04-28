<template>
	<!-- 飞书回调：全屏 loading，不展示登录页 -->
	<div v-if="feishuCallbackPending" class="feishu-fullscreen-loading">
		<div class="feishu-loading-card">
			<div class="feishu-loading-spinner">
				<div class="feishu-loading-bounce" />
				<div class="feishu-loading-bounce" />
				<div class="feishu-loading-bounce" />
			</div>
			<p class="feishu-loading-text">飞书登录中，请稍候…</p>
		</div>
	</div>

	<section v-else class="login-page">
		<!-- 左侧深色面板 -->
		<div class="login-hero">
			<div class="login-hero-pattern" />
			<div class="login-hero-content">
				<div class="brand-placeholder">
					<div class="brand-icon">DF</div>
					<div class="brand-text">DocFlow</div>
				</div>
				<h1 class="hero-title">
					<span class="hero-title-line">高效协作</span>
					<span class="hero-title-line hero-title-line--accent">从文档开始</span>
				</h1>
				<p class="hero-desc">统一管理 · 版本追溯 · 流程审批 · 安全可控</p>
			</div>
		</div>

		<!-- 右侧登录表单 -->
		<div class="login-content">
			<article class="login-card">
				<header class="login-header">
					<h2>账号登录</h2>
					<p>支持账号密码与飞书登录</p>
				</header>

				<el-form
ref="formRef" :model="form" :rules="rules" label-position="top" class="login-form"
					@submit.prevent="handleSubmit">
					<el-form-item label="账号（邮箱或飞书 Open ID）" prop="account">
						<el-input
v-model="form.account" placeholder="admin@docflow.local" autocomplete="username" clearable
							@keyup.enter="handleSubmit">
							<template #prefix>
								<el-icon>
									<User />
								</el-icon>
							</template>
						</el-input>
					</el-form-item>

					<el-form-item label="密码" prop="password">
						<el-input
v-model="form.password" type="password" show-password placeholder="请输入密码"
							autocomplete="current-password" @keyup.enter="handleSubmit">
							<template #prefix>
								<el-icon>
									<Lock />
								</el-icon>
							</template>
						</el-input>
					</el-form-item>

					<div class="login-row">
						<el-checkbox v-model="rememberSession" label="保持会话" />
					</div>

					<el-button class="login-submit" type="primary" :loading="submitting" @click="handleSubmit">
						登录
					</el-button>
				</el-form>

				<div class="login-divider">
					<span>或</span>
				</div>

				<el-button class="feishu-login-btn" :loading="feishuLoading" @click="handleFeishuLogin">
					<img class="feishu-icon" :src="feishuIconSrc" alt="飞书" width="18" height="18">
					飞书登录
				</el-button>

				<section class="login-tips">
					<p>演示账号：admin@docflow.local</p>
					<p>演示密码：Docflow@123（可通过 AUTH_DEMO_PASSWORD 配置）</p>
				</section>
			</article>
		</div>

		<CaptchaDialog v-model:visible="captchaVisible" @confirm="handleCaptchaConfirm" @cancel="handleCaptchaCancel" />
	</section>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import { apiLogin, apiFeishuAuthUrl, apiFeishuCallback } from '~/api/auth'
import feishuIconSrc from '~/assets/images/feishu.png'

const formRef = ref<FormInstance>()
const submitting = ref(false)
const feishuLoading = ref(false)
const rememberSession = ref(true)
const captchaVisible = ref(false)
const authStore = useAuthStore()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()

// 检测是否为飞书回调（URL 带 code）— 立即判定，不等 onMounted
const feishuCallbackPending = ref(false)
if (import.meta.client) {
	const params = new URLSearchParams(window.location.search)
	feishuCallbackPending.value = !!(params.get('code') && params.get('state'))
}

const form = reactive({
	account: 'admin@docflow.local',
	password: 'Docflow@123'
})

const rules: FormRules = {
	account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
	password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleSubmit = async () => {
	if (!formRef.value) {
		return
	}

	const valid = await formRef.value.validate().catch(() => false)
	if (!valid) {
		return
	}

	// 打开验证码弹窗，实际登录在 handleCaptchaConfirm 中完成
	captchaVisible.value = true
}

const handleCaptchaConfirm = async (captchaClicks: { x: number; y: number }[], captchaToken: string) => {
	captchaVisible.value = false
	submitting.value = true
	try {
		const response = await apiLogin({
			account: form.account,
			password: form.password,
			captchaClicks,
			captchaToken,
		})

		if (!response.success || !response.data) {
			msgError(response.message || '登录失败')
			submitting.value = false
			return
		}

		authStore.setSession(response.data)
		// 加载用户角色与权限
		await authStore.fetchProfile().catch(() => { })
		msgSuccess(response.message || '登录成功，正在进入系统')
		await navigateTo('/docs')
	} catch (error: unknown) {
		const maybeError = error as {
			data?: { message?: string }
		}
		msgError(maybeError?.data?.message || '登录失败，请稍后重试')
		submitting.value = false
	}
}

const handleCaptchaCancel = () => {
	submitting.value = false
}

// ================================================================
//  飞书 OAuth 登录
// ================================================================
const feishuEnabled = computed(() => !!runtimeConfig.public.feishuAppId)

/** 发起飞书授权 */
const handleFeishuLogin = async () => {
	if (!feishuEnabled.value) {
		msgWarning('飞书登录未配置')
		return
	}

	feishuLoading.value = true
	try {
		const redirectUri = window.location.origin + '/login'
		const res = await apiFeishuAuthUrl(redirectUri)

		if (!res.success || !res.data) {
			msgError(res.message || '获取飞书授权地址失败')
			return
		}

		// 存储 state 用于回调校验
		sessionStorage.setItem('feishu_oauth_state', res.data.state)
		// 跳转到飞书授权页
		window.location.href = res.data.authUrl
	} catch {
		msgError('飞书登录发起失败')
	} finally {
		feishuLoading.value = false
	}
}

/** 处理飞书 OAuth 回调（页面加载时检查 URL 中的 code 参数） */
const handleFeishuCallback = async () => {
	const code = route.query.code as string
	const state = route.query.state as string

	if (!code || !state) {
		feishuCallbackPending.value = false
		return
	}

	// 校验 state
	const savedState = sessionStorage.getItem('feishu_oauth_state')
	if (savedState && savedState !== state) {
		msgError('飞书授权状态不匹配，请重新登录')
		feishuCallbackPending.value = false
		return
	}
	sessionStorage.removeItem('feishu_oauth_state')

	feishuLoading.value = true
	try {
		const res = await apiFeishuCallback({ code, state })

		if (!res.success || !res.data) {
			msgError(res.message || '飞书登录失败')
			feishuLoading.value = false
			feishuCallbackPending.value = false
			return
		}

		authStore.setSession(res.data)
		await authStore.fetchProfile().catch(() => { })
		msgSuccess(res.message || '飞书登录成功，正在进入系统')
		await navigateTo('/docs')
	} catch {
		msgError('飞书登录失败，请稍后重试')
		feishuLoading.value = false
		feishuCallbackPending.value = false
	}
}

onMounted(() => {
	handleFeishuCallback()
})

definePageMeta({
	layout: 'auth'
})
useHead({ title: '登录 - DocFlow' })
</script>

<style lang="scss" scoped>
/* ============================================
   登录页 — Graphite Dual-tone
   ============================================ */
.login-page {
	position: relative;
	min-height: 100vh;
	display: flex;
	overflow: hidden;
	background: #f1f5f9;
}

/* ============================================
   左侧深色面板
   ============================================ */
.login-hero {
	position: relative;
	width: 44%;
	min-width: 400px;
	background: #1e293b;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

/* 几何网格纹理 */
.login-hero-pattern {
	position: absolute;
	inset: 0;
	background-image:
		linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
		linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
	background-size: 48px 48px;
	mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 70%);
	-webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 70%);
}

.login-hero-content {
	position: relative;
	z-index: 1;
	padding: 0 48px;
}

.brand-placeholder {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 48px;
}

.brand-icon {
	width: 38px;
	height: 38px;
	border-radius: 8px;
	background: #2563eb;
	color: #ffffff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 13px;
	font-weight: 800;
	letter-spacing: -0.5px;
}

.brand-text {
	color: #ffffff;
	font-family: var(--df-font-heading);
	font-size: 20px;
	font-weight: 700;
	letter-spacing: 0.5px;
}

.hero-title {
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.hero-title-line {
	display: block;
	font-family: var(--df-font-heading);
	font-size: clamp(28px, 3vw, 44px);
	font-weight: 800;
	letter-spacing: 1px;
	color: #e2e8f0;
	line-height: 1.3;

	&--accent {
		color: #3b82f6;
	}
}

.hero-desc {
	margin: 18px 0 0;
	font-size: 14px;
	color: #64748b;
	letter-spacing: 2px;
	font-weight: 400;
}

/* ============================================
   右侧登录表单
   ============================================ */
.login-content {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 32px;
}

.login-card {
	width: 400px;
	max-width: 100%;
	background: #ffffff;
	border-radius: var(--df-radius-lg, 12px);
	padding: 32px;
	box-shadow:
		0 1px 3px rgba(0, 0, 0, 0.04),
		0 4px 24px rgba(0, 0, 0, 0.06);
	transition: box-shadow 0.3s;

	&:hover {
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.04),
			0 8px 32px rgba(0, 0, 0, 0.08);
	}
}

.login-header {
	margin-bottom: 24px;

	h2 {
		margin: 0;
		text-align: center;
		font-family: var(--df-font-heading);
		font-size: 22px;
		font-weight: 700;
		color: #1e293b;
	}

	p {
		margin: 6px 0 0;
		color: #64748b;
		font-size: 13px;
		text-align: center;
	}
}

.login-form {
	:deep(.el-form-item) {
		margin-bottom: 18px;
	}

	:deep(.el-form-item__label) {
		color: #475569;
		font-weight: 500;
	}

	:deep(.el-input__wrapper) {
		min-height: 42px;
		border-radius: var(--df-radius-sm, 6px);
		box-shadow: 0 0 0 1px #e2e8f0 inset;
		background: #ffffff;
		transition: all 0.2s;

		&:hover {
			box-shadow: 0 0 0 1px #cbd5e1 inset;
		}

		&.is-focus {
			box-shadow: 0 0 0 1px #2563eb inset, 0 0 0 3px rgba(37, 99, 235, 0.12);
		}
	}
}

.login-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 2px 0 16px;
}

.login-submit {
	width: 100%;
	height: 42px;
	margin-top: 2px;
	border-radius: var(--df-radius-sm, 6px);
	font-size: 15px;
	font-weight: 600;
	letter-spacing: 1px;
	border: none;
	background: #2563eb;
	color: #fff;
	box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
	transition: all 0.2s;

	&:hover {
		background: #1d4ed8;
		box-shadow: 0 4px 16px rgba(37, 99, 235, 0.28);
	}

	&:active {
		background: #1e40af;
	}
}

.login-divider {
	display: flex;
	align-items: center;
	margin: 18px 0 14px;
	color: #94a3b8;
	font-size: 12px;

	&::before,
	&::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #e2e8f0;
	}

	span {
		padding: 0 12px;
	}
}

.feishu-login-btn {
	width: 100%;
	height: 42px;
	border-radius: var(--df-radius-sm, 6px);
	font-size: 14px;
	font-weight: 500;
	letter-spacing: 0.5px;
	background: #f8fafc;
	color: #475569;
	border: 1px solid #e2e8f0;
	transition: all 0.2s;

	&:hover,
	&:focus {
		background: #f1f5f9;
		color: #1e293b;
		border-color: #cbd5e1;
	}

	.feishu-icon {
		margin-right: 6px;
		border-radius: 4px;
	}
}

.login-tips {
	margin-top: 16px;
	padding: 10px 14px;
	border-radius: var(--df-radius-sm, 6px);
	border: 1px dashed #e2e8f0;
	background: #f8fafc;

	p {
		margin: 0;
		font-size: 12px;
		color: #64748b;

		&+p {
			margin-top: 3px;
		}
	}
}

/* ============================================
   响应式
   ============================================ */
@media (max-width: 1024px) {
	.login-hero {
		display: none;
	}
}

@media (max-width: 900px) {
	.login-content {
		padding: 16px;
	}

	.login-card {
		padding: 24px 20px;
	}
}

/* ---- 飞书全屏 loading ---- */
.feishu-fullscreen-loading {
	position: fixed;
	inset: 0;
	z-index: 100;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f1f5f9;
}

.feishu-loading-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 24px;
}

.feishu-loading-spinner {
	display: flex;
	gap: 8px;
}

.feishu-loading-bounce {
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: #2563eb;
	animation: feishu-bounce 1.4s ease-in-out infinite both;

	&:nth-child(1) {
		animation-delay: -0.32s;
	}

	&:nth-child(2) {
		animation-delay: -0.16s;
	}
}

@keyframes feishu-bounce {

	0%,
	80%,
	100% {
		transform: scale(0.4);
		opacity: 0.4;
	}

	40% {
		transform: scale(1);
		opacity: 1;
	}
}

.feishu-loading-text {
	margin: 0;
	font-size: 16px;
	color: #64748b;
	letter-spacing: 1px;
}
</style>
