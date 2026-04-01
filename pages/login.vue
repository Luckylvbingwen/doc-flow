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
		<!-- 极光背景 -->
		<div class="aurora-bg">
			<div class="aurora-ribbon aurora-ribbon--1" />
			<div class="aurora-ribbon aurora-ribbon--2" />
			<div class="aurora-ribbon aurora-ribbon--3" />
			<div class="aurora-glow aurora-glow--tl" />
			<div class="aurora-glow aurora-glow--br" />
		</div>

		<!-- 点阵纹理 -->
		<div class="dot-grid" />

		<!-- 左侧标语区 -->
		<div class="hero-area">
			<h1 class="hero-title">
				<span class="hero-title-line">高效协作</span>
				<span class="hero-title-line hero-title-line--accent">从文档开始</span>
			</h1>
			<p class="hero-desc">统一管理 · 版本追溯 · 流程审批 · 安全可控</p>
		</div>

		<div class="brand-placeholder">
			<div class="brand-icon">DF</div>
			<div class="brand-text">DocFlow 协作平台</div>
		</div>

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
					<img class="feishu-icon" :src="feishuIconSrc" alt="飞书" width="18" height="18" >
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
import { ElMessage } from 'element-plus'
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
			ElMessage.error(response.message || '登录失败')
			submitting.value = false
			return
		}

		authStore.setSession(response.data)
		// 加载用户角色与权限
		await authStore.fetchProfile().catch(() => { })
		ElMessage.success('登录成功，正在进入系统')
		await navigateTo('/docs')
	} catch (error: unknown) {
		const maybeError = error as {
			data?: { message?: string }
		}
		ElMessage.error(maybeError?.data?.message || '登录失败，请稍后重试')
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
		ElMessage.warning('飞书登录未配置')
		return
	}

	feishuLoading.value = true
	try {
		const redirectUri = window.location.origin + '/login'
		const res = await apiFeishuAuthUrl(redirectUri)

		if (!res.success || !res.data) {
			ElMessage.error(res.message || '获取飞书授权地址失败')
			return
		}

		// 存储 state 用于回调校验
		sessionStorage.setItem('feishu_oauth_state', res.data.state)
		// 跳转到飞书授权页
		window.location.href = res.data.authUrl
	} catch {
		ElMessage.error('飞书登录发起失败')
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
		ElMessage.error('飞书授权状态不匹配，请重新登录')
		feishuCallbackPending.value = false
		return
	}
	sessionStorage.removeItem('feishu_oauth_state')

	feishuLoading.value = true
	try {
		const res = await apiFeishuCallback({ code, state })

		if (!res.success || !res.data) {
			ElMessage.error(res.message || '飞书登录失败')
			return
		}

		authStore.setSession(res.data)
		await authStore.fetchProfile().catch(() => { })
		ElMessage.success('飞书登录成功，正在进入系统')
		await navigateTo('/docs')
	} catch {
		ElMessage.error('飞书登录失败，请稍后重试')
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
   页面
   ============================================ */
.login-page {
	position: relative;
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	padding-right: clamp(42px, 7vw, 128px);
	overflow: hidden;
	background: #fafbff;
}

/* ============================================
   极光背景
   ============================================ */
.aurora-bg {
	position: absolute;
	inset: 0;
	z-index: 0;
	overflow: hidden;
}

/* 三条极光色带 —— 不同色相、不同运动轨迹 */
.aurora-ribbon {
	position: absolute;
	width: 140%;
	height: 45%;
	border-radius: 50%;
	filter: blur(70px);
	opacity: 0;
	animation: aurora-breathe 8s ease-in-out infinite;

	&--1 {
		/* 暖橘 → 珊瑚粉 */
		top: -18%;
		left: -20%;
		background: linear-gradient(135deg, rgba(251, 191, 146, 0.38) 0%, rgba(252, 165, 165, 0.28) 50%, rgba(253, 230, 210, 0.15) 100%);
		animation-delay: 0s;
		animation-duration: 10s;
	}

	&--2 {
		/* 薄荷 → 天青 */
		top: 30%;
		left: -10%;
		background: linear-gradient(160deg, rgba(167, 243, 208, 0.25) 0%, rgba(147, 220, 252, 0.3) 55%, rgba(196, 231, 253, 0.12) 100%);
		animation-delay: 2.5s;
		animation-duration: 12s;
	}

	&--3 {
		/* 薰衣草 → 丁香 */
		bottom: -15%;
		right: -15%;
		background: linear-gradient(120deg, rgba(196, 181, 253, 0.22) 0%, rgba(233, 213, 255, 0.3) 50%, rgba(219, 234, 254, 0.12) 100%);
		animation-delay: 5s;
		animation-duration: 14s;
	}
}

@keyframes aurora-breathe {

	0%,
	100% {
		opacity: 0.3;
		transform: translateY(0) scale(1);
	}

	50% {
		opacity: 0.7;
		transform: translateY(-20px) scale(1.03);
	}
}

/* 角落弥散光 */
.aurora-glow {
	position: absolute;
	border-radius: 50%;
	filter: blur(100px);
	pointer-events: none;

	&--tl {
		width: 500px;
		height: 500px;
		top: -120px;
		left: -100px;
		background: radial-gradient(circle, rgba(251, 207, 177, 0.3), transparent 70%);
	}

	&--br {
		width: 420px;
		height: 420px;
		bottom: -80px;
		right: -60px;
		background: radial-gradient(circle, rgba(196, 181, 253, 0.2), transparent 70%);
	}
}

/* ============================================
   点阵纹理
   ============================================ */
.dot-grid {
	position: absolute;
	inset: 0;
	z-index: 0;
	background-image: radial-gradient(circle, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
	background-size: 28px 28px;
	mask-image: radial-gradient(ellipse 70% 70% at 35% 50%, black 20%, transparent 72%);
	-webkit-mask-image: radial-gradient(ellipse 70% 70% at 35% 50%, black 20%, transparent 72%);
}

/* ============================================
   左侧标语
   ============================================ */
.hero-area {
	position: absolute;
	left: clamp(48px, 8vw, 140px);
	top: 50%;
	transform: translateY(-50%);
	z-index: 1;
}

.hero-title {
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.hero-title-line {
	display: block;
	font-size: clamp(32px, 3.8vw, 52px);
	font-weight: 800;
	letter-spacing: 2px;
	color: #334155;
	line-height: 1.3;

	&--accent {
		background: linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
}

.hero-desc {
	margin: 18px 0 0;
	font-size: 15px;
	color: #94a3b8;
	letter-spacing: 3px;
	font-weight: 400;
}

/* ============================================
   品牌
   ============================================ */
.brand-placeholder {
	position: fixed;
	top: 24px;
	left: 30px;
	z-index: 10;
	display: inline-flex;
	align-items: center;
	gap: 10px;
}

.brand-icon {
	width: 34px;
	height: 34px;
	border-radius: 10px;
	background: linear-gradient(135deg, #f97316, #ec4899, #8b5cf6);
	color: #ffffff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	font-weight: 800;
	letter-spacing: -0.5px;
	box-shadow: 0 2px 8px rgba(249, 115, 22, 0.25);
}

.brand-text {
	color: #1e293b;
	font-size: 20px;
	font-weight: 700;
	letter-spacing: 0.5px;
}

/* ============================================
   登录卡片
   ============================================ */
.login-content {
	position: relative;
	z-index: 1;
	width: 420px;
}

.login-card {
	border-radius: 20px;
	background: rgba(255, 255, 255, 0.72);
	backdrop-filter: blur(24px) saturate(1.6);
	min-height: 450px;
	padding: 28px 32px 30px;
	box-shadow:
		0 0 0 1px rgba(255, 255, 255, 0.6),
		0 1px 2px rgba(0, 0, 0, 0.03),
		0 8px 32px rgba(0, 0, 0, 0.06);
	transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s;

	&:hover {
		transform: translateY(-2px);
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.7),
			0 1px 2px rgba(0, 0, 0, 0.03),
			0 16px 48px rgba(0, 0, 0, 0.09);
	}

	&-header {
		width: 100%;
		height: 92px;
		object-fit: cover;
		border-radius: 8px;
		display: block;
		margin-bottom: 16px;
	}
}

.login-header {
	h2 {
		margin: 0;
		text-align: center;
		font-size: 24px;
		font-weight: 700;
		color: #1e293b;
	}

	p {
		margin: 6px 0 0;
		color: #94a3b8;
		font-size: 13px;
		text-align: center;
	}
}

.login-form {
	margin-top: 22px;

	:deep(.el-form-item) {
		margin-bottom: 18px;
	}

	:deep(.el-form-item__label) {
		color: #475569;
		font-weight: 500;
	}

	:deep(.el-input__wrapper) {
		min-height: 44px;
		border-radius: 10px;
		box-shadow: 0 0 0 1px #e2e8f0 inset;
		background: rgba(255, 255, 255, 0.65);
		transition: all 0.2s;

		&:hover {
			box-shadow: 0 0 0 1px #cbd5e1 inset;
		}

		&.is-focus {
			box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.3) inset;
		}
	}
}

.login-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 2px 0 16px;
}

.preview-link {
	font-size: 12px;
	color: #6b7280;

	&:hover {
		color: var(--df-primary);
	}
}

.login-submit {
	width: 100%;
	height: 46px;
	margin-top: 2px;
	border-radius: 12px;
	font-size: 16px;
	font-weight: 600;
	letter-spacing: 2px;
	border: none;
	background: linear-gradient(135deg, #f97316 0%, #ec4899 60%, #8b5cf6 100%);
	color: #fff;
	box-shadow: 0 4px 16px rgba(249, 115, 22, 0.22);
	transition: all 0.25s;

	&:hover {
		box-shadow: 0 6px 24px rgba(249, 115, 22, 0.32);
		transform: translateY(-1px);
	}

	&:active {
		transform: translateY(0);
	}
}

.login-divider {
	display: flex;
	align-items: center;
	margin: 18px 0 14px;
	color: #9ca3af;
	font-size: 12px;

	&::before,
	&::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #e5e7eb;
	}

	span {
		padding: 0 12px;
	}
}

.feishu-login-btn {
	width: 100%;
	height: 44px;
	border-radius: 12px;
	font-size: 14px;
	font-weight: 500;
	letter-spacing: 0.5px;
	background: rgba(255, 255, 255, 0.5);
	color: #475569;
	border: 1px solid #e2e8f0;
	transition: all 0.2s;

	&:hover,
	&:focus {
		background: rgba(255, 255, 255, 0.8);
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
	border-radius: 10px;
	border: 1px dashed #e2e8f0;
	background: rgba(255, 255, 255, 0.4);

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
	.hero-area {
		display: none;
	}
}

@media (max-width: 900px) {
	.brand-placeholder {
		top: 12px;
		left: 14px;
	}

	.brand-text {
		font-size: 18px;
	}

	.login-page {
		justify-content: center;
		padding: 16px;
	}

	.login-content {
		width: min(100%, 420px);
	}

	.login-card {
		min-height: 420px;
		padding: 22px 18px 22px;
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
	background: linear-gradient(135deg, #fafbff 0%, #f5f3ff 100%);
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
	background: linear-gradient(135deg, #f97316, #ec4899);
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
	color: #6b7280;
	letter-spacing: 1px;
}
</style>
