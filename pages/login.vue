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

	<section v-else class="login-page" :style="loginPageStyle">
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

				<el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="login-form"
					@submit.prevent="handleSubmit">
					<el-form-item label="账号（邮箱或飞书 Open ID）" prop="account">
						<el-input v-model="form.account" placeholder="admin@docflow.local" autocomplete="username" clearable
							@keyup.enter="handleSubmit">
							<template #prefix>
								<el-icon>
									<User />
								</el-icon>
							</template>
						</el-input>
					</el-form-item>

					<el-form-item label="密码" prop="password">
						<el-input v-model="form.password" type="password" show-password placeholder="请输入密码"
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
					<img class="feishu-icon" :src="feishuIconSrc" alt="飞书" width="18" height="18" />
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
import loginBgSrc from '~/assets/images/login-bg.png'
import loginHeaderSrc from '~/assets/images/login-header.png'
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

const loginPageStyle = computed(() => ({
	backgroundImage: `linear-gradient(110deg, rgba(8, 31, 74, 0.7), rgba(14, 44, 96, 0.45) 35%, rgba(16, 56, 122, 0.25) 60%, rgba(255, 255, 255, 0) 85%), url('${loginBgSrc}')`
}))

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
		await authStore.fetchProfile().catch(() => {})
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
		await authStore.fetchProfile().catch(() => {})
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
</script>

<style lang="scss" scoped>
.login-page {
	position: relative;
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	padding-right: clamp(42px, 7vw, 128px);
	background-position: center center;
	background-size: cover;
	background-repeat: no-repeat;
}

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
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.24);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
	color: #ffffff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 13px;
	font-weight: 700;
}

.brand-text {
	color: #ffffff;
	font-size: 22px;
	font-weight: 700;
	letter-spacing: 0.6px;
}

.login-content {
	width: 430px;
}

.login-card {
	border-radius: 12px;
	background: rgba(255, 255, 255, 0.96);
	backdrop-filter: blur(2px);
	min-height: 450px;
	padding: 24px 30px 28px;
	box-shadow: 0 18px 38px rgba(15, 48, 138, 0.24);

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
		color: var(--df-primary);
		font-size: 26px;
		font-weight: 700;
	}

	p {
		margin: 8px 0 0;
		color: var(--df-subtext);
		font-size: 13px;
		text-align: center;
	}
}

.login-form {
	margin-top: 20px;

	:deep(.el-form-item) {
		margin-bottom: 18px;
	}

	:deep(.el-input__wrapper) {
		min-height: 42px;
		border-radius: 6px;
		box-shadow: 0 0 0 1px #d7dde9 inset;
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
	height: 44px;
	margin-top: 2px;
	border-radius: 999px;
	font-size: 17px;
	letter-spacing: 3px;
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
	border-radius: 999px;
	font-size: 15px;
	letter-spacing: 1px;
	background: #2b5aed;
	color: #ffffff;
	border: none;

	&:hover,
	&:focus {
		background: #3d6ef7;
		color: #ffffff;
	}

	.feishu-icon {
		margin-right: 6px;
		background: #ffffff;
		border-radius: 4px;
		padding: 2px;
	}
}

.login-tips {
	margin-top: 14px;
	padding: 10px 12px;
	border-radius: 10px;
	border: 1px dashed #c7d2fe;
	background: #eef2ff;

	p {
		margin: 0;
		font-size: 12px;
		color: #4338ca;

		& + p {
			margin-top: 4px;
		}
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
		background-position: center left;
	}

	.login-content {
		width: min(100%, 430px);
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
	background: linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 100%);
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
	background: linear-gradient(135deg, #3b82f6, #6366f1);
	animation: feishu-bounce 1.4s ease-in-out infinite both;

	&:nth-child(1) { animation-delay: -0.32s; }
	&:nth-child(2) { animation-delay: -0.16s; }
}

@keyframes feishu-bounce {
	0%, 80%, 100% {
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
